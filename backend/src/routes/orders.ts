import { Router } from "express";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
const query = z.object({
  status: z.enum(["ALL", ...Object.values(OrderStatus)]).default("ALL"),
  page: z.coerce.number().int().min(1).max(100000).default(1)
});
const orderSelect = {
  id: true, status: true, currency: true, subtotalCents: true, totalCents: true, provider: true, paidAt: true, createdAt: true,
  items: { select: { id: true, productName: true, variantName: true, unitPriceCents: true,
    product: { select: { type: true } }, variant: { select: { format: true, licenseName: true } }
  } }
} as const;
router.get("/", async (req, res) => {
  const input = query.safeParse(req.query);
  if (!input.success) return res.status(400).json({ message: "Filtros inválidos. Tente novamente." });
  const { status, page } = input.data;
  const userId = req.auth!.userId;
  const where = { userId, ...(status === "ALL" ? {} : { status }) };
  try {
    const [user, groups, total] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } }),
      prisma.order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
      prisma.order.count({ where })
    ]);
    if (!user) return res.status(401).json({ message: "Entre novamente para consultar seus pedidos." });
    const pages = Math.max(1, Math.ceil(total / 10));
    const currentPage = Math.min(page, pages);
    const orders = await prisma.order.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 10, skip: (currentPage - 1) * 10, select: orderSelect });
    const counts = { ALL: 0, PAID: 0, PENDING: 0, CANCELED: 0, REFUNDED: 0 };
    for (const group of groups) { counts[group.status] = group._count._all; counts.ALL += group._count._all; }
    res.json({ user, orders, counts, pagination: { page: currentPage, pages, total, pageSize: 10 } });
  } catch { res.status(503).json({ message: "Não foi possível carregar seus pedidos. Tente novamente." }); }
});
export default router;
