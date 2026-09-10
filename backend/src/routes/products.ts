import { Router } from "express";
import { ProductStatus, ProductType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const includeProduct = {
  category: true,
  variants: { where: { active: true }, orderBy: { priceCents: "asc" as const } },
  assets: { where: { kind: "COVER" as const }, select: { publicUrl: true, fileName: true } },
  previewGroups: { orderBy: { position: "asc" as const }, include: { items: { orderBy: { position: "asc" as const } } } }
};

router.get("/", async (req, res) => {
  const type = z.nativeEnum(ProductType).optional().safeParse(req.query.type);
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, ...(type.success && type.data ? { type: type.data } : {}) },
    include: includeProduct,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }]
  });
  res.json({ products });
});

router.get("/:slug", async (req, res) => {
  const product = await prisma.product.findFirst({ where: { slug: req.params.slug, status: ProductStatus.ACTIVE }, include: includeProduct });
  if (!product) return res.status(404).json({ message: "Produto não encontrado." });
  res.json({ product });
});

const productInput = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().min(10),
  description: z.string().min(20),
  type: z.nativeEnum(ProductType),
  categoryId: z.string().optional(),
  bpm: z.number().int().positive().optional(),
  musicalKey: z.string().optional(),
  featured: z.boolean().default(false),
  variants: z.array(z.object({
    name: z.string().min(1),
    sku: z.string().min(3),
    format: z.string().optional(),
    licenseName: z.string().optional(),
    priceCents: z.number().int().positive(),
    currency: z.string().length(3).default("BRL")
  })).min(1)
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = productInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Dados inválidos.", issues: input.error.issues });
  const { variants, ...data } = input.data;
  const product = await prisma.product.create({
    data: { ...data, status: ProductStatus.DRAFT, variants: { create: variants } },
    include: includeProduct
  });
  res.status(201).json({ product });
});

router.patch("/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  const product = await prisma.product.update({ where: { id: String(req.params.id) }, data: { status: ProductStatus.ACTIVE } });
  res.json({ product });
});

export default router;
