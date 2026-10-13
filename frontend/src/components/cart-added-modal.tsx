"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { money } from "@/lib/cart";

export function CartAddedModal({ productName, variantName, priceCents, currency, onClose }: {
  productName: string; variantName: string; priceCents: number; currency: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  const close = () => dialog.current?.close();
  return <dialog className="cart-added-modal" ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => { if (!dialog.current?.open) onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <button type="button" className="cart-modal-close" aria-label="Fechar confirmação" onClick={close}><X size={20}/></button>
    <div className="cart-added-icon"><Check size={28}/></div>
    <span className="section-index">Já está na sua seleção</span>
    <h2 id={titleId}>Adicionado ao carrinho</h2>
    <div className="cart-added-product"><div><strong>{productName}</strong><span>{variantName}</span></div><b>{money(priceCents, currency)}</b></div>
    <p id={descriptionId}>Quer ir ao carrinho ou continuar explorando os sons?</p>
    <div className="cart-added-actions"><Link className="primary-button" href="/cart" onClick={close}>Ir ao carrinho <ArrowRight size={17}/></Link><button type="button" className="cart-continue" onClick={close}>Continuar comprando</button></div>
  </dialog>;
}
