import { Router } from "express";
import path from "node:path";
import { stat } from "node:fs/promises";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";

// Never expose storage keys or private filesystem paths in the library response.
export function libraryFilePath(key: string) {
  const root = path.resolve(env.PRIVATE_STORAGE_PATH);
  const file = path.resolve(root, key);
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return file;
}
const router = Router();
router.use(requireAuth);
router.get("/", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true, email: true, role: true } });
    if (!user) return res.status(401).json({ message: "Entre novamente para acessar sua biblioteca." });
    const purchases = await prisma.orderItem.findMany({
      where: { order: { userId: req.auth!.userId, status: "PAID" } },
      orderBy: { order: { createdAt: "desc" } },
      include: {
        order: { select: { paidAt: true, createdAt: true } },
        variant: { select: { format: true, licenseName: true } },
        product: { select: {
          name: true, type: true, shortDescription: true, description: true, bpm: true, musicalKey: true, deliveryInstructions: true,
          assets: { where: { kind: { in: ["COVER", "DOWNLOAD"] } }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, variantId: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
          previewGroups: { orderBy: { position: "asc" }, select: { name: true, items: { orderBy: { position: "asc" }, select: { id: true, name: true, storageKey: true, durationSec: true } } } }
        } }
      }
    });
    const seen = new Set<string>();
    const items = purchases.filter(item => {
      const key = JSON.stringify([item.productId, item.variantId]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(item => {
      const cover = [...item.product.assets].reverse().find(asset => asset.kind === "COVER" && /^image\/(jpeg|png|webp|gif|avif)$/.test(asset.mimeType));
      return {
        id: item.id, productId: item.productId, name: item.productName, type: item.product.type,
        shortDescription: item.product.shortDescription, description: item.product.description,
        variantName: item.variantName, format: item.variant.format, licenseName: item.variant.licenseName,
        purchasedAt: item.order.paidAt ?? item.order.createdAt,
        bpm: item.product.bpm, musicalKey: item.product.musicalKey, instructions: item.product.deliveryInstructions,
        coverUrl: cover ? `/api/media/covers/${encodeURIComponent(cover.id)}` : null,
        previews: item.product.previewGroups.flatMap(group => group.items.map(preview => ({
          id: preview.id, name: preview.name, group: group.name, durationSec: preview.durationSec,
          url: `/api/media/previews/${encodeURIComponent(preview.storageKey)}`
        }))),
        files: item.product.assets.filter(asset => asset.kind === "DOWNLOAD" && (!asset.variantId || asset.variantId === item.variantId)).map(asset => ({
          id: asset.id, name: asset.fileName, mimeType: asset.mimeType, sizeBytes: Number(asset.sizeBytes), addedAt: asset.createdAt,
          url: `/api/account/library/${encodeURIComponent(item.id)}/files/${encodeURIComponent(asset.id)}`
        }))
      };
    });
    res.json({ user, items });
  } catch { res.status(503).json({ message: "Não foi possível carregar sua biblioteca. Tente novamente." }); }
});
router.get("/:purchaseId/files/:assetId", async (req, res) => {
  try {
    const purchase = await prisma.orderItem.findFirst({ where: { id: String(req.params.purchaseId), order: { userId: req.auth!.userId, status: "PAID" } }, select: { productId: true, variantId: true } });
    if (!purchase) return res.status(404).json({ message: "Este conteúdo não está disponível na sua biblioteca." });
    const asset = await prisma.mediaAsset.findFirst({ where: {
      id: String(req.params.assetId), productId: purchase.productId, kind: "DOWNLOAD",
      OR: [{ variantId: null }, { variantId: purchase.variantId }]
    } });
    if (!asset) return res.status(404).json({ message: "Arquivo não disponível nesta versão do produto." });
    const file = libraryFilePath(asset.storageKey);
    const info = file ? await stat(file).catch(() => null) : null;
    if (!file || !info?.isFile()) return res.status(404).json({ message: "Arquivo temporariamente indisponível. Entre em contato com o studio." });
    if (req.query.check === "1") return res.json({ ready: true });
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": "application/octet-stream" });
    res.download(file, asset.fileName, error => {
      if (error && !res.headersSent) res.status(404).json({ message: "Não foi possível baixar o arquivo. Tente novamente." });
    });
  } catch { if (!res.headersSent) res.status(503).json({ message: "Não foi possível iniciar o download." }); }
});
export default router;
