import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { createReadStream } from "node:fs";
import { mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
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

function run(command: string, args: string[], collect = false) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args);
    let output = ""; let error = "";
    if (collect) child.stdout.on("data", chunk => output += chunk.toString());
    child.stderr.on("data", chunk => error += chunk.toString());
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(error || command + " falhou.")));
  });
}

async function discardDraftProduct(productId: string) {
  const previews = await prisma.previewAudio.findMany({ where: { group: { productId } }, select: { storageKey: true } });
  await prisma.product.deleteMany({ where: { id: productId, status: "DRAFT" } });
  await Promise.all(previews.map(item => removeFile(previewPath(item.storageKey))));
}

router.get("/previews/:key", async (req, res) => {
  const preview = await prisma.previewAudio.findUnique({ where: { storageKey: req.params.key } });
  if (!preview) return res.status(404).json({ message: "Preview não encontrado." });
  const file = previewPath(preview.storageKey);
  const info = await stat(file).catch(() => null);
  if (!info) return res.status(404).json({ message: "Arquivo indisponível." });
  res.set({ "Content-Type": "audio/mpeg", "Content-Length": String(info.size), "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline", "Accept-Ranges": "none", "X-Content-Type-Options": "nosniff" });
  createReadStream(file).pipe(res);
});

router.post("/admin/products/:productId/assets", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecione um arquivo." });
  const body = z.object({ kind: z.nativeEnum(AssetKind), variantId: z.string().optional() }).safeParse(req.body);
  if (!body.success || body.data.kind === AssetKind.PREVIEW) { await removeFile(req.file.path); return res.status(400).json({ message: "Tipo de arquivo inválido." }); }
  const storageKey = `${nanoid()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await rename(req.file.path, privatePath(storageKey));
  const asset = await prisma.mediaAsset.create({ data: { productId: String(req.params.productId), kind: body.data.kind, storageKey, fileName: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size, variantId: body.data.variantId } });
  res.status(201).json({ asset: { ...asset, sizeBytes: Number(asset.sizeBytes) } });
});

router.post("/admin/products/:productId/beat-preview", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Envie o WAV ou MP3 de origem." });
  const input = z.object({ name: z.string().min(1).default("Preview"), startSec: z.coerce.number().min(0), endSec: z.coerce.number().positive() }).safeParse(req.body);
  if (!input.success || input.data.endSec <= input.data.startSec || input.data.endSec - input.data.startSec > 30) { await removeFile(req.file.path); return res.status(400).json({ message: "Selecione um trecho válido de até 30 segundos." }); }
  try {
    const generated = await generatePreview(req.file.path, input.data.startSec, input.data.endSec);
    const group = await prisma.previewGroup.upsert({ where: { id: `beat-${req.params.productId}` }, update: {}, create: { id: `beat-${req.params.productId}`, productId: String(req.params.productId), name: "Beat preview" } });
    await prisma.previewAudio.deleteMany({ where: { groupId: group.id } });
    const item = await prisma.previewAudio.create({ data: { groupId: group.id, name: input.data.name, storageKey: generated.fileName, publicUrl: `/api/media/previews/${generated.fileName}`, durationSec: generated.durationSec, sourceStartSec: input.data.startSec, sourceEndSec: input.data.endSec } });
    res.status(201).json({ preview: item });
  } catch (error) {
    await discardDraftProduct(String(req.params.productId));
    res.status(422).json({ message: error instanceof Error ? error.message : "Preview processing failed." });
  } finally { await removeFile(req.file.path); }
});

router.post("/admin/products/:productId/drum-kit-previews", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecione o arquivo ZIP do Drum Kit." });
  const product = await prisma.product.findUnique({ where: { id: String(req.params.productId) } });
  if (!product || product.type !== ProductType.DRUM_KIT) { await removeFile(req.file.path); return res.status(400).json({ message: "O produto selecionado não é um Drum Kit." }); }
  const work = await mkdtemp(path.join(tmpdir(), "hs-kit-"));
  try {
    const listing = await run("unzip", ["-Z1", req.file.path], true);
    const audio = listing.split(/\r?\n/).filter(name => /\.(wav|mp3|aiff|aif|flac)$/i.test(name) && !name.includes("__MACOSX"));
    const byGroup = new Map<string,string[]>();
    for (const entry of audio) {
      const parts = entry.split("/").filter(Boolean);
      const group = parts.length > 1 ? parts.at(-2)! : "Samples";
      const values = byGroup.get(group) ?? [];
      if (values.length < 2) { values.push(entry); byGroup.set(group, values); }
    }
    if (!byGroup.size) await discardDraftProduct(product.id);
    if (!byGroup.size) return res.status(400).json({ message: "Nenhum áudio compatível foi encontrado no ZIP." });
    const old = await prisma.previewAudio.findMany({ where: { group: { productId: product.id } }, select: { storageKey: true } });
    await prisma.previewGroup.deleteMany({ where: { productId: product.id } });
    await Promise.all(old.map(item => removeFile(previewPath(item.storageKey))));
    let total = 0; let position = 0;
    for (const [groupName, entries] of byGroup) {
      const group = await prisma.previewGroup.create({ data: { productId: product.id, name: groupName, position: position++ } });
      let itemPosition = 0;
      for (const entry of entries) {
        const source = path.join(work, `source-${nanoid()}${path.extname(entry)}`);
        const bytes = await new Promise<Buffer>((resolve, reject) => {
          const child = spawn("unzip", ["-p", req.file!.path, entry]); const chunks: Buffer[] = []; let error = "";
          child.stdout.on("data", chunk => chunks.push(chunk)); child.stderr.on("data", chunk => error += chunk.toString());
          child.on("close", code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(error || "Falha ao extrair áudio."))); child.on("error", reject);
        });
        await writeFile(source, bytes);
        const generated = await generatePreview(source, 0, 8);
        await prisma.previewAudio.create({ data: { groupId: group.id, name: path.basename(entry, path.extname(entry)), storageKey: generated.fileName, publicUrl: `/api/media/previews/${generated.fileName}`, durationSec: generated.durationSec, position: itemPosition++ } });
        total++;
      }
    }
    res.status(201).json({ message: `${total} previews gerados em ${byGroup.size} categorias.`, groups: byGroup.size, previews: total });
  } catch (error) {
    await discardDraftProduct(product.id);
    res.status(422).json({ message: error instanceof Error ? error.message : "Não foi possível processar o ZIP." });
  } finally { await removeFile(req.file.path); await rm(work, { recursive: true, force: true }); }
});

export default router;

