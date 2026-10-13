"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { StoreProduct } from "./product-card";
import { useCart } from "./cart-provider";
import { CartAddedModal } from "./cart-added-modal";
import { money } from "@/lib/cart";
export function ProductPurchase({ product }: { product: StoreProduct }) {
  const cart = useCart();
  const cartLink = useRef<HTMLAnchorElement>(null);
  const [confirmation, setConfirmation] = useState<StoreProduct["variants"][number] | null>(null);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const current = cart.products?.find(item => item.id === product.id);
  const variants = cart.products ? current?.variants ?? [] : product.variants;
  const selected = variants.find(item => item.id === variantId);
  const added = cart.items.some(item => item.productId === product.id && item.variantId === variantId);
  return <div className="product-purchase">
    <fieldset className="purchase-options"><legend>Escolha o formato / licença</legend>
      {variants.map(variant => <label key={variant.id} className={variant.id === variantId ? "selected" : ""}>
        <input type="radio" name={"variant-" + product.id} value={variant.id} checked={variant.id === variantId} onChange={() => setVariantId(variant.id)}/>
        <span><strong>{variant.name}</strong><small>{variant.licenseName ?? variant.format ?? "Licença digital"}</small></span><b>{money(variant.priceCents, variant.currency)}</b>
      </label>)}
    </fieldset>
    {selected && <strong className="detail-price">{money(selected.priceCents, selected.currency)}</strong>}
    <button type="button" className="primary-button" disabled={!selected || !cart.products || !!cart.error || added || cart.items.length >= 100} onClick={() => { if (!selected) return; cart.add({ productId: product.id, variantId }); setConfirmation(selected); }}>
      {added ? <Check size={18}/> : <ShoppingBag size={18}/>} {added ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
    </button>
    <div aria-live="polite">{added && <p className="purchase-feedback">Este formato já está no seu carrinho. <Link ref={cartLink} href="/cart">Ver carrinho →</Link></p>}</div>
    {confirmation && <CartAddedModal productName={product.name} variantName={[confirmation.name, confirmation.licenseName].filter(Boolean).join(" · ")} priceCents={confirmation.priceCents} currency={confirmation.currency} onClose={() => { setConfirmation(null); cartLink.current?.focus(); }}/> }
    {cart.error ? <p role="alert">{cart.error} <button type="button" onClick={cart.refresh}>Tentar novamente</button></p> : cart.products && !selected ? <p>Este formato não está disponível no momento.</p> : null}
  </div>;
}
