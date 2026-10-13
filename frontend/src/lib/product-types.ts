export const productTypes = {
  BEAT: "Beats",
  DRUM_KIT: "Drum kits",
  SAMPLE_PACK: "Sample packs",
  PRESET: "Presets",
  COURSE: "Cursos",
  EBOOK: "E-books",
  TEMPLATE: "Templates",
  DIGITAL_PRODUCT: "Outros produtos digitais"
} as const;
export type ProductType = keyof typeof productTypes;
export function productTypeLabel(type: string) {
  return productTypes[type as ProductType] || "Produtos digitais";
}
