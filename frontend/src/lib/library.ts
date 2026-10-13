export type LibraryItem = {
  id: string; productId: string; name: string; type: string;
  shortDescription: string; description: string; variantName: string;
  format: string | null; licenseName: string | null; purchasedAt: string;
  bpm: number | null; musicalKey: string | null; instructions: string | null; coverUrl: string | null;
  previews: Array<{ id: string; name: string; group: string; durationSec: number | null; url: string }>;
  files: Array<{ id: string; name: string; mimeType: string; sizeBytes: number; addedAt: string; url: string }>;
};
export const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterLibrary(items: LibraryItem[], query: string, type: string, sort: string) {
  const search = normalizeSearch(query.trim());
  return items.filter(item => (type === "ALL" || item.type === type) && normalizeSearch([item.name, item.shortDescription, item.variantName, item.format, item.licenseName].filter(Boolean).join(" ")).includes(search))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : sort === "oldest" ? Date.parse(a.purchasedAt) - Date.parse(b.purchasedAt) : Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt));
}
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
}
