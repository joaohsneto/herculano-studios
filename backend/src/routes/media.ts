import { kitPreviewRouter } from "./kit-previews.js";
import { libraryFilePath } from "./library.js";
import { isValidPreviewRange } from "../services/preview-range.js";
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { rename, stat } from "node:fs/promises";
import { nanoid } from "nanoid";
import { AssetKind, ProductType } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { ensureStorage, generatePreview, previewPath, privatePath, removeFile } from "../services/media.js";

await ensureStorage();
const upload = multer({ dest: path.resolve(env.PRIVATE_STORAGE_PATH), limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 } });
const router = Router();

router.get("/previews/:key", async (req, res) => {
  const preview = await prisma.previewAudio.findUnique({ where: { storageKey: req.params.key } });
  if (!preview) return res.status(404).json({ message: "Preview não encontrado." });
  const file = previewPath(preview.storageKey);
  const info = await stat(file).catch(() => null);
  if (!info) return res.status(404).json({ message: "Arquivo indisponível." });
  const extension = path.extname(preview.storageKey).toLowerCase();
  const mimeType = extension === ".wav" ? "audio/wav" : extension === ".flac" ? "audio/flac" : extension === ".aif" || extension === ".aiff" ? "audio/aiff" : "audio/mpeg";
  res.set({ "Content-Type": mimeType, "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" });
  // Express handles Safari byte-range requests (206/416) and HEAD responses.
  res.sendFile(file, { acceptRanges: true });
});

router.get("/covers/:id", async (req, res) => {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: String(req.params.id), kind: "COVER" } });
  if (!asset || !/^image\/(jpeg|png|webp|gif|avif)$/.test(asset.mimeType)) return res.status(404).json({ message: "Capa indisponível." });
  const file = libraryFilePath(asset.storageKey);
  if (!file || !await stat(file).catch(() => null)) return res.status(404).json({ message: "Capa indisponível." });
  res.set({ "Content-Type": asset.mimeType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" });
  res.sendFile(file);
});

router.get("/admin/products/:productId/assets", requireAuth, requireAdmin, async (req, res) => {
  const assets = await prisma.mediaAsset.findMany({ where: { productId: String(req.params.productId), kind: { in: ["DOWNLOAD", "COVER"] } }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true, sizeBytes: true, variantId: true } });
  res.json({ assets: assets.map(asset => ({ ...asset, sizeBytes: Number(asset.sizeBytes) })) });
});

router.post("/admin/products/:productId/assets", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecione um arquivo." });
  const body = z.object({ kind: z.enum(["COVER", "DOWNLOAD"]), variantId: z.string().min(1).optional() }).safeParse(req.body);
  if (!body.success) { await removeFile(req.file.path); return res.status(400).json({ message: "Tipo de arquivo inválido." }); }
  const productId = String(req.params.productId);
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { variants: { select: { id: true } } } });
  if (!product || (body.data.variantId && !product.variants.some(variant => variant.id === body.data.variantId))) {
    await removeFile(req.file.path); return res.status(400).json({ message: "Produto ou versão inválida." });
  }
  if (body.data.kind === "COVER" && (!/^image\/(jpeg|png|webp|gif|avif)$/.test(req.file.mimetype) || req.file.size > 10 * 1024 * 1024)) {
    await removeFile(req.file.path); return res.status(400).json({ message: "Envie uma capa JPG, PNG, WebP, GIF ou AVIF de até 10 MB." });
  }
  const storageKey = `${nanoid()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  try {
    await rename(req.file.path, privatePath(storageKey));
    const asset = await prisma.mediaAsset.create({ data: { productId, kind: body.data.kind, storageKey, fileName: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size, variantId: body.data.kind === "DOWNLOAD" ? body.data.variantId : undefined } });
    res.status(201).json({ asset: { id: asset.id, fileName: asset.fileName, sizeBytes: Number(asset.sizeBytes), variantId: asset.variantId } });
  } catch {
    await removeFile(req.file.path); await removeFile(privatePath(storageKey));
    res.status(503).json({ message: "Não foi possível salvar o arquivo." });
  }
});

router.get("/admin/products/:productId/beat-preview", requireAuth, requireAdmin, async (req, res) => {
  const productId = String(req.params.productId);
  const preview = await prisma.previewAudio.findFirst({ where: { groupId: `beat-${productId}` }, orderBy: { id: "desc" } });
  const source = await prisma.mediaAsset.findUnique({ where: { id: `beat-source-${productId}` } });
  const available = source && await stat(privatePath(source.storageKey)).catch(() => null);
  res.json({ preview, source: available ? { fileName: source.fileName, url: `/api/media/admin/products/${productId}/beat-source` } : null });
});

router.get("/admin/products/:productId/beat-source", requireAuth, requireAdmin, async (req, res) => {
  const source = await prisma.mediaAsset.findUnique({ where: { id: `beat-source-${req.params.productId}` } });
  if (!source || !await stat(privatePath(source.storageKey)).catch(() => null)) return res.status(404).json({ message: "Áudio original indisponível." });
  res.set({ "Cache-Control": "private, no-store", "Content-Type": source.mimeType });
  res.sendFile(privatePath(source.storageKey));
});

router.post("/admin/products/:productId/beat-preview", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  const productId = String(req.params.productId);
  const input = z.object({ name: z.string().min(1).default("Preview"), startSec: z.coerce.number().min(0), endSec: z.coerce.number().positive() }).safeParse(req.body);
  if (!input.success || !isValidPreviewRange(input.data.startSec, input.data.endSec)) {
    if (req.file) await removeFile(req.file.path);
    return res.status(400).json({ message: "Selecione um trecho válido de até 30 segundos." });
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.type !== ProductType.BEAT) {
    if (req.file) await removeFile(req.file.path);
    return res.status(404).json({ message: "Beat não encontrado." });
  }
  const sourceId = `beat-source-${productId}`;
  const oldSource = await prisma.mediaAsset.findUnique({ where: { id: sourceId } });
  const inputPath = req.file?.path ?? (oldSource ? privatePath(oldSource.storageKey) : null);
  if (!inputPath) return res.status(400).json({ message: "Envie o áudio original para editar este preview." });
  let generatedPath: string | undefined;
  let newSourcePath: string | undefined;
  try {
    const generated = await generatePreview(inputPath, input.data.startSec, input.data.endSec);
    generatedPath = generated.outputPath;
    const sourceKey = req.file ? `beat-source-${nanoid()}${path.extname(req.file.originalname).toLowerCase()}` : undefined;
    if (req.file && sourceKey) {
      newSourcePath = privatePath(sourceKey);
      await rename(req.file.path, newSourcePath);
    }
    const oldPreviews = await prisma.previewAudio.findMany({ where: { groupId: `beat-${productId}` }, select: { storageKey: true } });
    const item = await prisma.$transaction(async tx => {
      if (req.file && sourceKey) {
        const data = { productId, kind: AssetKind.PREVIEW, storageKey: sourceKey, fileName: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size };
        await tx.mediaAsset.upsert({ where: { id: sourceId }, create: { id: sourceId, ...data }, update: data });
      }
      const group = await tx.previewGroup.upsert({ where: { id: `beat-${productId}` }, update: {}, create: { id: `beat-${productId}`, productId, name: "Beat preview" } });
      await tx.previewAudio.deleteMany({ where: { groupId: group.id } });
      return tx.previewAudio.create({ data: { groupId: group.id, name: input.data.name, storageKey: generated.fileName, publicUrl: `/api/media/previews/${generated.fileName}`, durationSec: generated.durationSec, sourceStartSec: input.data.startSec, sourceEndSec: input.data.endSec } });
    });
    generatedPath = undefined;
    newSourcePath = undefined;
    await Promise.all(oldPreviews.map(item => removeFile(previewPath(item.storageKey))));
    if (sourceKey && oldSource) await removeFile(privatePath(oldSource.storageKey));
    res.status(201).json({ preview: item });
  } catch (error) {
    if (generatedPath) await removeFile(generatedPath);
    if (newSourcePath) await removeFile(newSourcePath);
    res.status(422).json({ message: error instanceof Error ? error.message : "Falha ao gerar preview." });
  } finally { if (req.file) await removeFile(req.file.path); }
});

router.use("/admin/products/:productId/drum-kit-previews", requireAuth, requireAdmin, kitPreviewRouter(upload));

export default router;
