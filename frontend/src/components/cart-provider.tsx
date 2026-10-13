"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { StoreProduct } from "./product-card";
import { addCartItem, CART_KEY, readCart, type CartPick } from "@/lib/cart";
const EVENT = "hs-cart-change";
let memory = "[]";
let memoryOnly = false;
function snapshot() { if (memoryOnly) return memory; try { return localStorage.getItem(CART_KEY) ?? "[]"; } catch { return memory; } }
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === CART_KEY || event.key === null) notify(); };
  window.addEventListener("storage", onStorage); window.addEventListener(EVENT, notify);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(EVENT, notify); };
}
function save(items: CartPick[]) {
  memory = JSON.stringify(items);
  try { localStorage.setItem(CART_KEY, memory); } catch { memoryOnly = true; }
  window.dispatchEvent(new Event(EVENT));
}
type CartContextValue = {
  items: CartPick[]; products: StoreProduct[] | null; error: string;
  add: (item: CartPick) => void; remove: (variantId: string) => void; clear: () => void; refresh: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const items = useMemo(() => readCart(raw), [raw]);
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    return fetch("/api/products", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(data => { setProducts(data.products); setError(""); })
      .catch(() => setError("Não foi possível atualizar os preços. Tente novamente."));
  }, []);
  useEffect(() => { void refresh(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  return <CartContext.Provider value={{ items, products, error, refresh,
    add: item => save(addCartItem(readCart(snapshot()), item)),
    remove: variantId => save(readCart(snapshot()).filter(item => item.variantId !== variantId)),
    clear: () => save([])
  }}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider não encontrado");
  return value;
}
