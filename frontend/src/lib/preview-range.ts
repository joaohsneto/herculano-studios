export type PreviewRange = { start: number; end: number };
export type RangePart = "start" | "end" | "window";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Work in tenths of a second so moving a 30-second window cannot grow it.
export function movePreviewRange(range: PreviewRange, part: RangePart, delta: number, duration: number): PreviewRange {
  const total = Math.floor(duration * 10);
  const start = Math.round(range.start * 10);
  const end = Math.round(range.end * 10);
  const shift = Math.round(delta * 10);
  if (part === "start") return { start: clamp(start + shift, Math.max(0, end - 300), end - 1) / 10, end: end / 10 };
  if (part === "end") return { start: start / 10, end: clamp(end + shift, start + 1, Math.min(total, start + 300)) / 10 };
  const next = clamp(start + shift, 0, total - (end - start));
  return { start: next / 10, end: (next + end - start) / 10 };
}
