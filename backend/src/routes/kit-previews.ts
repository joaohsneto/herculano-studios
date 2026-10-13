import { Router } from "express";
import type multer from "multer";
import path from "node:path";
import { rename, stat } from "node:fs/promises";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { privatePath, previewPath, removeFile } from "../services/media.js";
import { chooseKitEntries, createKitPreview, discardGenerated, listKitEntries, type KitEntry } from "../services/kit-preview.js";

const locks = new Set<string>();
async function sourceFor(productId: string) {
  const saved = await prisma.mediaAsset.findUnique({ where: { id: `kit-source-${productId}` } });
  if (saved && await stat(privatePath(saved.storageKey)).catch(() => null)) return saved;
  const archives = await prisma.mediaAsset.findMany({ where: { productId, kind: "DOWNLOAD" }, orderBy: { createdAt: "desc" } });
  for (const asset of archives) if (/\.zip$/i.test(asset.fileName) && await stat(privatePath(asset.storageKey)).catch(() => null)) return asset;
  return null;
}
function entriesForGroup(entries: KitEntry[], group: { name: string; items: Array<{ name: string; sourceEntry: string | null }> }) {
  const folder = group.items.find(item => item.sourceEntry)?.sourceEntry;
  return entries.filter(entry => folder ? entry.folder === path.posix.dirname(folder) : entry.group === group.name);
}
function selectedEntry(entry: KitEntry, items: Array<{ name: string; sourceEntry: string | null }>) {
  return items.some(item => item.sourceEntry ? item.sourceEntry === entry.entry : item.name === entry.name);
}
export function kitPreviewRouter(upload: multer.Multer) {
  const router = Router({ mergeParams: true });
  router.use(async (req, res, next) => {
    const product = await prisma.product.findUnique({ where: { id: String(req.params.productId) }, select: { type: true } });
    if (!product || product.type !== "DRUM_KIT") return res.status(404).json({ message: "Drum kit não encontrado." });
    next();
  });
  router.get<{ productId: string }>("/", async (req, res) => {
    const productId = String(req.params.productId);
    const source = await sourceFor(productId);
    const groups = await prisma.previewGroup.findMany({ where: { productId }, orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } });
    res.set("Cache-Control", "private, no-store");
    if (!source) return res.json({ sourceAvailable: false, groups: groups.map(group => ({ ...group, candidates: [] })) });
    try {
      const entries = await listKitEntries(privatePath(source.storageKey));
      res.json({ sourceAvailable: true, groups: groups.map(group => ({ ...group, candidates: entriesForGroup(entries, group).map(entry => ({ entry: entry.entry, name: entry.name, selected: selectedEntry(entry, group.items) })) })) });
    } catch { res.status(422).json({ message: "Não foi possível ler os sons do ZIP. Envie o arquivo novamente." }); }
  });
  router.get<{ productId: string }>("/audition", async (req, res) => {
    const productId = String(req.params.productId);
    const entryName = z.string().min(1).max(2048).safeParse(req.query.entry);
    if (!entryName.success) return res.status(400).json({ message: "Selecione um som válido." });
    const source = await sourceFor(productId);
    if (!source) return res.status(404).json({ message: "Envie o ZIP original para ouvir os sons." });
    try {
      const entry = (await listKitEntries(privatePath(source.storageKey))).find(item => item.entry === entryName.data);
      if (!entry) return res.status(404).json({ message: "Som não encontrado neste kit." });
      const generated = await createKitPreview(privatePath(source.storageKey), entry);
      // No PreviewAudio record: this temporary audition can never be fetched publicly.
      res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.once("close", () => { void removeFile(generated.outputPath); });
      res.sendFile(generated.outputPath);
    } catch { res.status(422).json({ message: "Não foi possível preparar este som para audição." }); }
  });
  router.post<{ productId: string; previewId: string }>("/:previewId/replacement", async (req, res) => {
    const productId = String(req.params.productId);
    const input = z.object({ entry: z.string().min(1).max(2048).optional(), random: z.boolean().optional(), expectedKey: z.string().min(1) }).safeParse(req.body);
    if (!input.success || (!input.data.entry && !input.data.random)) return res.status(400).json({ message: "Escolha um som ou sorteie outro." });
    if (locks.has(productId)) return res.status(409).json({ message: "Outra prévia está sendo processada. Aguarde e tente novamente." });
    locks.add(productId); let generated: Awaited<ReturnType<typeof createKitPreview>> | undefined;
    try {
      const current = await prisma.previewAudio.findFirst({ where: { id: String(req.params.previewId), group: { productId } }, include: { group: { include: { items: true } } } });
      if (!current) return res.status(404).json({ message: "Prévia não encontrada neste kit." });
      if (current.storageKey !== input.data.expectedKey) return res.status(409).json({ message: "Esta prévia foi alterada. Atualize a lista antes de trocar." });
      const source = await sourceFor(productId);
      if (!source) return res.status(400).json({ message: "Envie o ZIP original para trocar os sons." });
      const candidates = entriesForGroup(await listKitEntries(privatePath(source.storageKey)), current.group).filter(entry => !selectedEntry(entry, current.group.items));
      const chosen = input.data.random ? chooseKitEntries(candidates, 1)[0] : candidates.find(entry => entry.entry === input.data.entry);
      if (!chosen) return res.status(400).json({ message: "Não há outro som disponível nesta pasta, ou ele já está em uso." });
      generated = await createKitPreview(privatePath(source.storageKey), chosen);
      const update = await prisma.previewAudio.updateMany({ where: { id: current.id, storageKey: input.data.expectedKey }, data: { name: chosen.name, sourceEntry: chosen.entry, storageKey: generated.fileName, publicUrl: `/api/media/previews/${generated.fileName}`, durationSec: generated.durationSec, sourceStartSec: 0, sourceEndSec: 8 } });
      if (!update.count) return res.status(409).json({ message: "A prévia mudou durante o processamento. Atualize a lista." });
      generated = undefined;
      await removeFile(previewPath(current.storageKey));
      res.json({ message: "Prévia substituída. A outra prévia foi mantida." });
    } catch { res.status(422).json({ message: "Não foi possível trocar o som. A prévia anterior foi preservada." }); }
    finally { if (generated) await removeFile(generated.outputPath); locks.delete(productId); }
  });
  router.post<{ productId: string }>("/", upload.single("file"), async (req, res) => {
    const productId = String(req.params.productId);
    if (!req.file) return res.status(400).json({ message: "Selecione o ZIP original do drum kit." });
    if (locks.has(productId)) { await removeFile(req.file.path); return res.status(409).json({ message: "O kit está sendo processado. Tente novamente em instantes." }); }
    locks.add(productId);
    const generated: Array<Awaited<ReturnType<typeof createKitPreview>>> = [];
    let newSourcePath: string | undefined;
    try {
      const entries = await listKitEntries(req.file.path);
      if (!entries.length) return res.status(400).json({ message: "Nenhum áudio compatível foi encontrado no ZIP." });
      const oldSource = await prisma.mediaAsset.findUnique({ where: { id: `kit-source-${productId}` } });
      const old = await prisma.previewAudio.findMany({ where: { group: { productId } }, select: { storageKey: true } });
      // Attaching an archive to an existing kit preserves its manually selected sounds.
      if (old.length && !oldSource) {
        const groups = await prisma.previewGroup.findMany({ where: { productId }, include: { items: true } });
        if (groups.some(group => group.items.some(item => !entriesForGroup(entries, group).some(entry => item.sourceEntry ? entry.entry === item.sourceEntry : entry.name === item.name)))) return res.status(400).json({ message: "Este ZIP não corresponde às prévias atuais. Envie o ZIP original deste kit." });
      } else if (old.length) return res.status(400).json({ message: "O ZIP já está salvo. Use Trocar som para preservar suas escolhas." });
      const batches: Array<{ name: string; sounds: Array<{ entry: KitEntry; generated: Awaited<ReturnType<typeof createKitPreview>> }> }> = [];
      if (!old.length) {
        const folders = new Map<string, KitEntry[]>();
        for (const entry of entries) folders.set(entry.folder, [...(folders.get(entry.folder) ?? []), entry]);
        for (const sounds of folders.values()) {
          const batch: typeof batches[number] = { name: sounds[0]!.group, sounds: [] };
          for (const entry of chooseKitEntries(sounds, 2)) { const result = await createKitPreview(req.file.path, entry); generated.push(result); batch.sounds.push({ entry, generated: result }); }
          batches.push(batch);
        }
      }
      const storageKey = `kit-source-${nanoid()}.zip`;
      newSourcePath = privatePath(storageKey); await rename(req.file.path, newSourcePath);
      await prisma.$transaction(async tx => {
        await tx.mediaAsset.upsert({ where: { id: `kit-source-${productId}` }, create: { id: `kit-source-${productId}`, productId, kind: "PREVIEW", storageKey, fileName: req.file!.originalname, mimeType: "application/zip", sizeBytes: req.file!.size }, update: { storageKey, fileName: req.file!.originalname, sizeBytes: req.file!.size } });
        if (batches.length) {
          await tx.previewGroup.deleteMany({ where: { productId } });
          for (const [position, batch] of batches.entries()) await tx.previewGroup.create({ data: { productId, name: batch.name, position, items: { create: batch.sounds.map(({ entry, generated: result }, position) => ({ name: entry.name, sourceEntry: entry.entry, storageKey: result.fileName, publicUrl: `/api/media/previews/${result.fileName}`, durationSec: result.durationSec, sourceStartSec: 0, sourceEndSec: 8, position })) } } });
        } else {
          const groups = await tx.previewGroup.findMany({ where: { productId }, include: { items: true } });
          for (const group of groups) for (const item of group.items) {
            const entry = entriesForGroup(entries, group).find(entry => entry.name === item.name);
            if (entry) await tx.previewAudio.update({ where: { id: item.id }, data: { sourceEntry: entry.entry } });
          }
        }
      });
      newSourcePath = undefined; generated.length = 0;
      if (oldSource) await removeFile(privatePath(oldSource.storageKey));
      res.status(201).json({ message: batches.length ? "Duas prévias sorteadas por pasta. Você já pode trocar cada som individualmente." : "ZIP salvo. Suas prévias atuais foram preservadas." });
    } catch { res.status(422).json({ message: "Não foi possível processar o ZIP. As prévias existentes foram preservadas." }); }
    finally { await discardGenerated(generated); if (newSourcePath) await removeFile(newSourcePath); await removeFile(req.file.path); locks.delete(productId); }
  });
  return router;
}
