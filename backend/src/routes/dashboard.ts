import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/account/dashboard", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: { select: { slug: true, type: true } }, variant: { select: { format: true } } } } }
      }
    }
  });
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  const paidOrders = user.orders.filter((order) => order.status === "PAID");
  const library = paidOrders.flatMap((order) => order.items.map((item) => ({
    orderId: order.id,
    productId: item.productId,
    productName: item.productName,
    productSlug: item.product.slug,
    productType: item.product.type,
    variantName: item.variantName,
    format: item.variant.format,
    purchasedAt: order.paidAt ?? order.createdAt
  })));
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }, orders: user.orders, library });
});

router.get("/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
  const [products, orders, customers, revenue, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.order.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } }, items: true } })
  ]);
  res.json({ stats: { products, orders, customers, revenueCents: revenue._sum.totalCents ?? 0 }, recentOrders });
});

router.get("/admin/orders", requireAuth, requireAdmin, async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } }, items: true }
  });
  res.json({ orders });
});

export default router;
