import { spawn } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { previewDuration } from "./preview-range.js";

export async function ensureStorage() {
  await Promise.all([mkdir(path.resolve(env.PRIVATE_STORAGE_PATH), { recursive: true }), mkdir(path.resolve(env.PREVIEW_STORAGE_PATH), { recursive: true })]);
}
export function privatePath(fileName: string) { return path.resolve(env.PRIVATE_STORAGE_PATH, fileName); }
export function previewPath(fileName: string) { return path.resolve(env.PREVIEW_STORAGE_PATH, fileName); }

export async function generatePreview(inputPath: string, startSec: number, endSec: number) {
  const durationSec = previewDuration(startSec, endSec);
  const fadeIn = Math.min(0.08, durationSec / 2);
  const fadeOut = Math.min(0.12, durationSec / 2);
  const fadeFilter = `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${durationSec - fadeOut}:d=${fadeOut}`;
  await ensureStorage();
  const fileName = `${nanoid()}.mp3`;
  const outputPath = previewPath(fileName);
  try {
    await new Promise<void>((resolve, reject) => {
      const process = spawn(env.FFMPEG_PATH, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(startSec), "-t", String(durationSec), "-i", inputPath, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "96k", "-af", fadeFilter, outputPath]);
      let error = "";
      process.stderr.on("data", (chunk) => { error += chunk.toString(); });
      process.on("error", reject);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(error || "Falha ao gerar preview.")));
    });
    return { fileName, outputPath, durationSec };
  } catch (error) {
    await removeFile(outputPath);
    throw error instanceof Error ? error : new Error("Falha ao gerar preview.");
  }
}
export async function removeFile(filePath: string) { await unlink(filePath).catch(() => undefined); }
