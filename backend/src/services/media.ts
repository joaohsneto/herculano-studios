import { spawn } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";

export async function ensureStorage() {
  await Promise.all([mkdir(path.resolve(env.PRIVATE_STORAGE_PATH), { recursive: true }), mkdir(path.resolve(env.PREVIEW_STORAGE_PATH), { recursive: true })]);
}
export function privatePath(fileName: string) { return path.resolve(env.PRIVATE_STORAGE_PATH, fileName); }
export function previewPath(fileName: string) { return path.resolve(env.PREVIEW_STORAGE_PATH, fileName); }

export async function generatePreview(inputPath: string, startSec: number, endSec: number) {
  if (startSec < 0 || endSec <= startSec || endSec - startSec > 30) throw new Error("O recorte deve ter entre 0 e 30 segundos.");
  await ensureStorage();
  const fileName = `${nanoid()}.mp3`;
  const outputPath = previewPath(fileName);
  await new Promise<void>((resolve, reject) => {
    const process = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(startSec), "-to", String(endSec), "-i", inputPath, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "96k", "-af", "afade=t=in:st=0:d=0.08,afade=t=out:st=0:d=0.12", outputPath]);
    let error = "";
    process.stderr.on("data", (chunk) => { error += chunk.toString(); });
    process.on("error", () => reject(new Error("FFmpeg nao esta disponivel no servidor. Instale-o e tente novamente.")));
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(error || "Falha ao gerar preview.")));
  });
  return { fileName, outputPath, durationSec: endSec - startSec };
}
export async function removeFile(filePath: string) { await unlink(filePath).catch(() => undefined); }
