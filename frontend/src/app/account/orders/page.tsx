"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock3, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeLab } from "@/components/theme-lab";
import { money } from "@/lib/cart";
import { productTypeLabel } from "@/lib/product-types";

type Status = "ALL" | "PAID" | "PENDING" | "CANCELED" | "REFUNDED";
type Order = { id: string; status: Exclude<Status, "ALL">; currency: string; subtotalCents: number; totalCents: number; provider: string | null; paidAt: string | null; createdAt: string;
  items: Array<{ id: string; productName: string; variantName: string; unitPriceCents: number; product: { type: string }; variant: { format: string | null; licenseName: string | null } }> };
type OrdersData = { user: { name: string; role: "ADMIN" | "CUSTOMER" }; orders: Order[]; counts: Record<Status, number>; pagination: { page: number; pages: number; total: number } };
const labels = { ALL: "Todos", PAID: "Pagos", PENDING: "Pendentes", CANCELED: "Cancelados", REFUNDED: "Reembolsados" };
const singular = { PAID: "Pago", PENDING: "Pendente", CANCELED: "Cancelado", REFUNDED: "Reembolsado" };
const descriptions = {
  PAID: "Pagamento confirmado. Acesse os produtos deste pedido na sua biblioteca.",
  PENDING: "Este pedido aguarda a confirmação do pagamento. Os materiais desta compra serão liberados na biblioteca após a confirmação.",
  CANCELED: "Este pedido foi cancelado e não libera acesso aos produtos. Uma outra compra paga do mesmo produto continua válida.",
  REFUNDED: "Este pedido foi marcado como reembolsado e não libera acesso aos produtos. Uma outra compra paga do mesmo produto continua válida."
};
const providers: Record<string, string> = { STRIPE: "Stripe", PAYPAL: "PayPal", MERCADO_PAGO: "Mercado Pago", MANUAL: "Confirmação pelo estúdio" };
const date = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Maceio" });

function OrderCard({ order }: { order: Order }) {
  const reference = `#${order.id.slice(-7).toUpperCase()}`;
  return <article className="purchase-card">
    <header className="purchase-card-header"><div><span className="purchase-label">Pedido</span><h2>{reference}</h2><small>{date(order.createdAt)}</small></div><span className={`purchase-status purchase-${order.status.toLowerCase()}`}>{order.status === "PAID" ? <PackageCheck size={15}/> : order.status === "PENDING" ? <Clock3 size={15}/> : <ReceiptText size={15}/>} {singular[order.status]}</span><div className="purchase-total"><small>Total da compra</small><strong>{money(order.totalCents, order.currency)}</strong></div></header>
    <div className="purchase-overview"><ShoppingBag size={20}/><p><strong>{order.items[0]?.productName || "Pedido registrado"}</strong>{order.items.length > 1 && <span> e mais {order.items.length - 1} {order.items.length === 2 ? "produto" : "produtos"}</span>}<small>{order.items.length} {order.items.length === 1 ? "produto nesta compra" : "produtos nesta compra"}</small></p></div>
    <p className={`purchase-message purchase-message-${order.status.toLowerCase()}`}>{descriptions[order.status]}</p>
    <details className="purchase-details"><summary>Ver detalhes do pedido <ChevronRight size={17}/></summary><div className="purchase-detail-content">
      <h3>Produtos comprados</h3><ul className="purchase-items">{order.items.map(item => <li key={item.id}><div><strong>{item.productName}</strong><span>{productTypeLabel(item.product.type)} · {item.variantName}{item.variant.format && item.variant.format !== item.variantName ? ` · ${item.variant.format}` : ""}</span>{item.variant.licenseName && <small>Licença: {item.variant.licenseName}</small>}</div><strong>{money(item.unitPriceCents, order.currency)}</strong></li>)}</ul>
      <dl className="purchase-payment"><div><dt>Subtotal</dt><dd>{money(order.subtotalCents, order.currency)}</dd></div>{order.subtotalCents > order.totalCents && <div><dt>Desconto / abatimento</dt><dd>− {money(order.subtotalCents - order.totalCents, order.currency)}</dd></div>}{order.totalCents > order.subtotalCents && <div><dt>Ajustes no total</dt><dd>{money(order.totalCents - order.subtotalCents, order.currency)}</dd></div>}<div className="purchase-payment-total"><dt>Total</dt><dd>{money(order.totalCents, order.currency)}</dd></div>{order.provider && <div><dt>Pagamento</dt><dd>{providers[order.provider] || "Registrado pelo estúdio"}</dd></div>}{order.paidAt && <div><dt>Pagamento confirmado em</dt><dd>{date(order.paidAt)}</dd></div>}<div className="purchase-reference"><dt>Número completo do pedido</dt><dd>{order.id}</dd></div></dl>
    </div></details>
    <footer className="purchase-actions"><Link href={`/contact?order=${encodeURIComponent(order.id)}`}>Ajuda com este pedido <ArrowUpRight size={16}/></Link>{order.status === "PAID" && <Link className="dashboard-cta" href="/account/library">Acessar meus produtos <ArrowUpRight size={17}/></Link>}</footer>
  </article>;
}

export default function OrdersPage() {
  const router = useRouter();
  const [data, setData] = useState<OrdersData | null>(null); const [status, setStatus] = useState<Status>("ALL"); const [page, setPage] = useState(1); const [error, setError] = useState(""); const [busy, setBusy] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/account/orders?${new URLSearchParams({ status, page: String(page) })}`, { credentials: "include", cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.status === 401) { router.push("/login"); return; }
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível carregar seus pedidos."); setData(result); setError("");
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar seus pedidos."); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [status, page, retry, router]);
  return <main className="dashboard-shell"><DashboardSidebar admin={data?.user.role === "ADMIN"} userName={data?.user.name}/><section className="dashboard-content purchases-content">
    <header className="dashboard-topbar purchases-topbar"><div><span className="section-index">Minhas compras / Herculano Studios</span><h1>Meus pedidos</h1><p>Acompanhe cada compra, confira os valores e veja a situação do pagamento.</p></div><Link href="/account/library">Minha biblioteca <ArrowUpRight size={18}/></Link></header>
    <div className="purchases-summary">{[{ label: "Pedidos registrados", value: data?.counts.ALL, Icon: ReceiptText }, { label: "Compras pagas", value: data?.counts.PAID, Icon: PackageCheck }, { label: "Aguardando confirmação", value: data?.counts.PENDING, Icon: Clock3 }].map(({ label, value, Icon }) => <article key={label}><Icon size={22}/><div><strong>{value === undefined ? "—" : String(value).padStart(2, "0")}</strong><span>{label}</span></div></article>)}</div>
    <div className="purchase-filters" role="group" aria-label="Filtrar pedidos por situação">{(Object.keys(labels) as Status[]).map(value => <button key={value} type="button" aria-pressed={status === value} disabled={busy} onClick={() => { if (value === status) return; setStatus(value); setPage(1); setBusy(true); }}>{labels[value]}{data && <span>{data.counts[value]}</span>}</button>)}</div>
    <div className="purchase-result-count" role="status">{busy ? "Carregando pedidos..." : data ? `${data.pagination.total} ${data.pagination.total === 1 ? "pedido encontrado" : "pedidos encontrados"}` : ""}</div>
    {error ? <div className="purchase-empty" role="alert"><ReceiptText size={32}/><h2>Não foi possível carregar seus pedidos</h2><p>{error}</p><button className="dashboard-cta" onClick={() => { setError(""); setBusy(true); setRetry(value => value + 1); }}>Tentar novamente</button></div> : busy ? <div className="purchase-empty" role="status"><Clock3 size={32}/><p>Consultando suas compras...</p></div> : data?.orders.length ? <div className="purchase-list">{data.orders.map(order => <OrderCard key={order.id} order={order}/>)}</div> : <div className="purchase-empty"><ShoppingBag size={40} strokeWidth={1.3}/><h2>{data?.counts.ALL ? "Nenhum pedido nesta situação" : "Sua primeira compra começa aqui."}</h2><p>{data?.counts.ALL ? "Selecione outra situação para consultar suas compras." : "Quando você fizer uma compra, os produtos, valores e a situação do pedido aparecerão aqui."}</p>{data?.counts.ALL ? <button className="dashboard-cta" onClick={() => { setStatus("ALL"); setPage(1); setBusy(true); }}>Ver todos os pedidos</button> : <Link href="/products" className="dashboard-cta">Explorar catálogo <ArrowUpRight size={17}/></Link>}</div>}
    {data && !busy && !error && data.pagination.pages > 1 && <nav className="purchase-pagination" aria-label="Paginação dos pedidos"><button disabled={data.pagination.page <= 1} onClick={() => { setPage(data.pagination.page - 1); setBusy(true); }}><ChevronLeft size={17}/>Anterior</button><span>Página {data.pagination.page} de {data.pagination.pages}</span><button disabled={data.pagination.page >= data.pagination.pages} onClick={() => { setPage(data.pagination.page + 1); setBusy(true); }}>Próxima<ChevronRight size={17}/></button></nav>}
    <footer className="purchases-help"><span>Seus arquivos e materiais ficam na Minha biblioteca.</span><Link href="/contact">Falar com o estúdio <ArrowUpRight size={16}/></Link></footer>
  </section><ThemeLab/></main>;
}
