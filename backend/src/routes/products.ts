import { Router } from "express";
import { Prisma, ProductStatus, ProductType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { previewPath, privatePath, removeFile } from "../services/media.js";

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
  try {
    const product = await prisma.product.create({
      data: { ...data, status: ProductStatus.DRAFT, variants: { create: variants } },
      include: includeProduct
    });
    res.status(201).json({ product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ message: "Este slug já está em uso. Escolha outro endereço para o produto." });
    }
    throw error;
  }
});

router.patch("/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  const product = await prisma.product.update({ where: { id: String(req.params.id) }, data: { status: ProductStatus.ACTIVE } });
  res.json({ product });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      assets: { select: { storageKey: true } },
      previewGroups: { include: { items: { select: { storageKey: true } } } },
      orderItems: { select: { id: true }, take: 1 }
    }
  });
  if (!product) return res.status(404).json({ message: "Produto não encontrado." });
  if (product.orderItems.length) return res.status(409).json({ message: "Este produto possui vendas registradas e não pode ser excluído." });

  const privateFiles = product.assets.map(asset => privatePath(asset.storageKey));
  const previewFiles = product.previewGroups.flatMap(group => group.items.map(item => previewPath(item.storageKey)));
  await prisma.product.delete({ where: { id } });
  await Promise.all([...privateFiles, ...previewFiles].map(removeFile));
  res.json({ message: "Produto e previews excluídos com sucesso." });
});

export default router;
