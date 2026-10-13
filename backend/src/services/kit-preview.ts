import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomInt } from "node:crypto";
import { generatePreview, removeFile } from "./media.js";

export type KitEntry = { entry: string; name: string; folder: string; group: string };
export function parseKitListing(listing: string): KitEntry[] {
  return [...new Set(listing.split(/\r?\n/))].filter(entry => {
    const parts = entry.split("/");
    return /\.(wav|mp3|aiff|aif|flac)$/i.test(entry) && !entry.startsWith("/") && !entry.includes("\\") && !/[\x00-\x1f]/.test(entry) && !parts.some(part => part === ".." || part === "__MACOSX" || part.startsWith("."));
  }).map(entry => ({ entry, name: path.posix.basename(entry, path.posix.extname(entry)), folder: path.posix.dirname(entry), group: path.posix.dirname(entry) === "." ? "Samples" : path.posix.basename(path.posix.dirname(entry)) }));
}
export function chooseKitEntries(entries: KitEntry[], count: number): KitEntry[] {
  const pool = [...entries]; const selected: KitEntry[] = [];
  while (pool.length && selected.length < count) selected.push(pool.splice(randomInt(pool.length), 1)[0]!);
  return selected;
}
export async function listKitEntries(zip: string) {
  const listing = await new Promise<string>((resolve, reject) => {
    const child = spawn("unzip", ["-Z1", zip]); let text = ""; let error = "";
    child.stdout.on("data", chunk => { text += chunk; if (text.length > 4 * 1024 * 1024) { child.kill(); reject(new Error("O ZIP contém arquivos demais.")); } });
    child.stderr.on("data", chunk => { error = (error + chunk).slice(-1000); });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(text) : reject(new Error(error || "Não foi possível ler o ZIP.")));
  });
  const entries = parseKitListing(listing);
  if (entries.length > 10000) throw new Error("O kit excede o limite de 10.000 sons.");
  return entries;
}
export async function createKitPreview(zip: string, entry: KitEntry) {
  const work = await mkdtemp(path.join(tmpdir(), "hs-kit-choice-"));
  const source = path.join(work, "source" + path.posix.extname(entry.entry));
  try {
    await new Promise<void>((resolve, reject) => {
      // Escape unzip patterns so a filename cannot select additional entries.
      const pattern = entry.entry.replace(/([\\*?\[\]])/g, "\\$1");
      const child = spawn("unzip", ["-p", zip, pattern]);
      const output = createWriteStream(source); let size = 0; let error = ""; let closed = false; let finished = false;
      const fail = (reason: Error) => { child.kill(); output.destroy(); reject(reason); };
      const done = () => { if (closed && finished) resolve(); };
      child.stdout.on("data", chunk => { size += chunk.length; if (size > 128 * 1024 * 1024) fail(new Error("O áudio excede o limite de 128 MB para prévias.")); });
      child.stdout.pipe(output); child.stderr.on("data", chunk => { error = (error + chunk).slice(-1000); });
      output.on("error", fail); output.on("finish", () => { finished = true; done(); });
      child.on("error", fail); child.on("close", code => { if (code !== 0) fail(new Error(error || "Falha ao extrair o som.")); else { closed = true; done(); } });
    });
    return await generatePreview(source, 0, 8);
  } finally { await rm(work, { recursive: true, force: true }); }
}
export async function discardGenerated(items: Array<{ outputPath: string }>) {
  await Promise.all(items.map(item => removeFile(item.outputPath)));
}
