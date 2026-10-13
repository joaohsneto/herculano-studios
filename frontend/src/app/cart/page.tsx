"use client";
import Link from "next/link";
import { ShoppingBag, Trash2, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/components/cart-provider";
import { money } from "@/lib/cart";
export default function CartPage() {
  const cart = useCart();
  const lines = cart.items.map(item => {
    const product = cart.products?.find(product => product.id === item.productId);
    return { ...item, product, variant: product?.variants.find(variant => variant.id === item.variantId) };
  });
  const totals = new Map<string, number>();
  for (const line of lines) if (line.variant) totals.set(line.variant.currency, (totals.get(line.variant.currency) ?? 0) + line.variant.priceCents);
  const unavailable = lines.some(line => !line.variant);
  return <><SiteHeader/><main className="cart-page">
    <span className="section-index">Sua seleção</span><h1>Carrinho</h1><p className="cart-intro">Seus próximos sons, em um só lugar.</p>
    {!cart.items.length ? <section className="cart-empty"><ShoppingBag size={42}/><h2>Seu carrinho está vazio</h2><p>Explore os beats e drum kits e escolha os sons da sua próxima produção.</p><Link className="primary-button" href="/products">Explorar produtos →</Link></section>
      : <div className="cart-layout"><section aria-label="Itens do carrinho">
        <div className="cart-list-heading"><span>{cart.items.length} {cart.items.length === 1 ? "item" : "itens"}</span><button type="button" onClick={cart.clear}>Limpar carrinho</button></div>
        {lines.map(line => <article className="cart-line" key={line.variantId}>
          <div className="cart-art" aria-hidden="true"><ShoppingBag/></div>
          <div className="cart-item-copy">{line.product ? <><span className="section-index">{line.product.type.replaceAll("_", " ")}</span><h2><Link href={"/products/" + line.product.slug}>{line.product.name}</Link></h2><p>{line.variant ? [line.variant.name, line.variant.licenseName].filter(Boolean).join(" · ") : "Formato indisponível"}</p></> : <h2>{cart.products ? "Produto indisponível" : "Carregando produto…"}</h2>}
            <small>Licença digital · 1 unidade</small></div>
          <div className="cart-line-actions"><strong>{line.variant ? money(line.variant.priceCents, line.variant.currency) : "—"}</strong><button type="button" aria-label={"Remover " + (line.product?.name ?? "produto") + " " + (line.variant?.name ?? "")} onClick={() => cart.remove(line.variantId)}><Trash2 size={16}/> Remover</button></div>
        </article>)}
        <Link className="cart-back" href="/products"><ArrowLeft size={16}/> Continuar comprando</Link>
      </section><aside className="cart-summary"><h2>Resumo</h2><p>Produtos digitais. Sem frete.</p>
        {cart.error ? <p role="alert">{cart.error} <button type="button" onClick={cart.refresh}>Tentar novamente</button></p> : !cart.products ? <p>Atualizando preços…</p> : <>
          {Array.from(totals).map(([currency, total]) => <div className="cart-total" key={currency}><span>{unavailable ? "Subtotal disponível" : "Total"}</span><strong>{money(total, currency)}</strong></div>)}
          {unavailable && <p role="status">Remova os itens indisponíveis para continuar.</p>}
        </>}
        <p className="cart-checkout-note">Seu carrinho está salvo neste navegador. O pagamento online estará disponível em breve.</p>
      </aside></div>}
  </main></>;
}
