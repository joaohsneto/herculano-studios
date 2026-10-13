export type CartPick = { productId: string; variantId: string };
export const CART_KEY = "hs-cart-v1";
export function readCart(raw: string): CartPick[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.filter((item): item is CartPick => {
      if (!item || typeof item.productId !== "string" || typeof item.variantId !== "string" || !item.productId || !item.variantId) return false;
      const key = JSON.stringify([item.productId, item.variantId]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 100).map(({ productId, variantId }) => ({ productId, variantId }));
  } catch { return []; }
}
export function addCartItem(items: CartPick[], item: CartPick): CartPick[] {
  return items.some(existing => existing.productId === item.productId && existing.variantId === item.variantId) ? items : [...items, item].slice(0, 100);
}
export const money = (cents: number, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
