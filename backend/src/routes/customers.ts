import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { currentMonthStart, customerLibrary, summarizeOrders } from "../services/customers.js";

const router = Router();
router.use(requireAuth, requireAdmin);
const querySchema = z.object({
  q: z.string().trim().max(150).default(""), filter: z.enum(["all", "buyers", "no_purchases"]).default("all"),
  sort: z.enum(["newest", "oldest", "name", "spent"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100000).default(1)
});
const PAGE_SIZE = 15;
type CustomerRow = { id: string; name: string; email: string; createdAt: Date; paidOrders: number; lastPurchaseAt: Date | null; totals: Array<{ currency: string; totalCents: number }> };
router.get("/", async (req, res) => {
  const input = querySchema.safeParse(req.query);
  if (!input.success) return res.status(400).json({ message: "Filtros inválidos. Revise a busca e tente novamente." });
  const { q, filter, sort, page } = input.data;
  const search = `%${q.replace(/[\\%_]/g, char => `\\${char}`)}%`;
  const textFilter = q ? Prisma.sql`AND (u."name" ILIKE ${search} OR u."email" ILIKE ${search} OR u."phone" ILIKE ${search})` : Prisma.empty;
  const purchaseFilter = filter === "buyers" ? Prisma.sql`AND p."paidOrders" > 0` : filter === "no_purchases" ? Prisma.sql`AND p."paidOrders" = 0` : Prisma.empty;
  const countPurchaseFilter = filter === "buyers" ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'PAID')` : filter === "no_purchases" ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'PAID')` : Prisma.empty;
  const ordering = sort === "name" ? Prisma.sql`u."name" ASC, u."id" ASC` : sort === "oldest" ? Prisma.sql`u."createdAt" ASC, u."id" ASC` : sort === "spent" ? Prisma.sql`p."spentBRL" DESC, u."createdAt" DESC, u."id" ASC` : Prisma.sql`u."createdAt" DESC, u."id" ASC`;
  try {
    const [viewer, counted, registered, buyers, newThisMonth, customers] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true } }),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "User" u WHERE u."role" = 'CUSTOMER' ${textFilter} ${countPurchaseFilter}`),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "CUSTOMER", orders: { some: { status: "PAID" } } } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: currentMonthStart() } } }),
      prisma.$queryRaw<CustomerRow[]>(Prisma.sql`
        SELECT u."id", u."name", u."email", u."createdAt", p."paidOrders", p."lastPurchaseAt", t."totals"
        FROM "User" u
        CROSS JOIN LATERAL (
          SELECT COUNT(*)::int AS "paidOrders", MAX(COALESCE(o."paidAt", o."createdAt")) AS "lastPurchaseAt",
            COALESCE(SUM(o."totalCents") FILTER (WHERE o."currency" = 'BRL'), 0) AS "spentBRL"
          FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'PAID'
        ) p
        CROSS JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('currency', c.currency, 'totalCents', c.total) ORDER BY c.currency), '[]'::jsonb) AS "totals"
          FROM (SELECT o."currency" AS currency, SUM(o."totalCents") AS total FROM "Order" o
            WHERE o."userId" = u."id" AND o."status" = 'PAID' GROUP BY o."currency") c
        ) t
        WHERE u."role" = 'CUSTOMER' ${textFilter} ${purchaseFilter}
        ORDER BY ${ordering} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `)
    ]);
    const total = counted[0]?.count || 0;
    return res.json({ viewer, stats: { registered, buyers, newThisMonth }, customers, pagination: { page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } });
  } catch { return res.status(503).json({ message: "Não foi possível carregar os clientes. Tente novamente." }); }
});
router.get("/:id", async (req, res) => {
  const pageInput = z.coerce.number().int().min(1).max(100000).default(1).safeParse(req.query.ordersPage);
  if (!pageInput.success) return res.status(400).json({ message: "Página de pedidos inválida." });
  const id = String(req.params.id); const page = pageInput.data;
  try {
    const customer = await prisma.user.findFirst({ where: { id, role: "CUSTOMER" }, select: { id: true, name: true, email: true, phone: true, company: true, createdAt: true } });
    if (!customer) return res.status(404).json({ message: "Cliente não encontrado." });
    const [allOrders, orders, purchasedItems] = await Promise.all([
      prisma.order.findMany({ where: { userId: id }, select: { id: true, status: true, totalCents: true, currency: true, createdAt: true, paidAt: true } }),
      prisma.order.findMany({ where: { userId: id }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 10, skip: (page - 1) * 10, select: {
        id: true, status: true, totalCents: true, currency: true, createdAt: true, paidAt: true,
        items: { select: { productName: true, variantName: true, unitPriceCents: true, product: { select: { type: true } } } }
      } }),
      prisma.orderItem.findMany({ where: { order: { userId: id } }, select: {
        productId: true, variantId: true, productName: true, variantName: true,
        product: { select: { type: true, assets: { where: { kind: "DOWNLOAD" }, select: { variantId: true } } } },
        variant: { select: { format: true, licenseName: true } },
        order: { select: { id: true, status: true, createdAt: true, paidAt: true } }
      } })
    ]);
    const library = customerLibrary(purchasedItems);
    return res.json({ customer, summary: { ...summarizeOrders(allOrders), libraryCount: library.filter(item => item.access === "AVAILABLE").length }, orders, library,
      ordersPagination: { page, pages: Math.max(1, Math.ceil(allOrders.length / 10)), total: allOrders.length } });
  } catch { return res.status(503).json({ message: "Não foi possível carregar este cliente. Tente novamente." }); }
});
export default router;
