const MAX_PREVIEW_SECONDS = 30;
const ROUNDING_TOLERANCE_SECONDS = 1e-9;

export function isValidPreviewRange(startSec: number, endSec: number): boolean {
  return Number.isFinite(startSec) && Number.isFinite(endSec)
    && startSec >= 0 && endSec > startSec
    && endSec - startSec <= MAX_PREVIEW_SECONDS + ROUNDING_TOLERANCE_SECONDS;
}

export function previewDuration(startSec: number, endSec: number): number {
  if (!isValidPreviewRange(startSec, endSec)) {
    throw new Error("Selecione um trecho com duração maior que zero e de até 30 segundos, em qualquer parte da música.");
  }
  return Math.min(MAX_PREVIEW_SECONDS, endSec - startSec);
}
