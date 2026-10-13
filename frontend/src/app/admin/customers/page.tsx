"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, CircleCheck, Clock3, Mail, PackageOpen, Search, ShoppingBag, UserPlus, UsersRound, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeLab } from "@/components/theme-lab";
import { productTypeLabel } from "@/lib/product-types";
import { money } from "@/lib/cart";

type Total = { currency: string; totalCents: number };
type Customer = { id: string; name: string; email: string; createdAt: string; paidOrders: number; lastPurchaseAt: string | null; totals: Total[] };
type CustomerList = { viewer: { name: string }; stats: { registered: number; buyers: number; newThisMonth: number }; customers: Customer[]; pagination: { page: number; pages: number; total: number } };
type Detail = {
  customer: { id: string; name: string; email: string; phone: string | null; company: string | null; createdAt: string };
  summary: { totalOrders: number; paidOrders: number; totals: Total[]; libraryCount: number };
  orders: Array<{ id: string; status: string; totalCents: number; currency: string; createdAt: string; items: Array<{ productName: string; variantName: string; product: { type: string } }> }>;
  ordersPagination: { page: number; pages: number; total: number };
  library: Array<{ id: string; name: string; type: string; variantName: string; format: string | null; licenseName: string | null; access: string; reason: string; orderId: string; filesCount: number }>;
};
const date = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Maceio" });
const orderLabels: Record<string, string> = { PAID: "Pago", PENDING: "Pendente", CANCELED: "Cancelado", REFUNDED: "Reembolsado" };
const initials = (name: string) => name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();
function Totals({ totals }: { totals: Total[] }) { return <>{totals.length ? totals.map(total => <span className="customer-money" key={total.currency}>{money(total.totalCents, total.currency)}</span>) : <span className="customer-muted">—</span>}</>; }

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Detail | null>(null); const [error, setError] = useState(""); const [tab, setTab] = useState("profile"); const [page, setPage] = useState(1); const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(true);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/customers/${encodeURIComponent(id)}?ordersPage=${page}`, { credentials: "include", cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.status === 401) { router.push("/login"); return; }
      if (response.status === 403) { router.push("/account"); return; }
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível carregar o cliente.");
      setData(result); setError("");
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar o cliente."); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [id, page, retry, router]);
  return <dialog ref={dialog} className="customer-drawer" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-labelledby="customer-detail-title">
    <header className="customer-drawer-header"><div><span className="section-index">Detalhes do cliente</span><h2 id="customer-detail-title">{data?.customer.name || "Carregando cliente..."}</h2>{data && <p>{data.customer.email}</p>}</div><button type="button" onClick={onClose} aria-label="Fechar detalhes" autoFocus><X size={21}/></button></header>
    {error ? <div className="customers-state" role="alert"><p>{error}</p><button className="dashboard-cta" onClick={() => { setError(""); setBusy(true); setRetry(value => value + 1); }}>Tentar novamente</button></div> : !data ? <p className="customers-state" role="status">Carregando cadastro e compras...</p> : <>
      <div className="customer-detail-metrics"><div><strong>{data.summary.paidOrders}</strong><span>Compras pagas</span></div><div><strong>{data.summary.libraryCount}</strong><span>Produtos liberados</span></div><div><strong><Totals totals={data.summary.totals}/></strong><span>Total em compras pagas</span></div></div>
      <div className="customer-detail-tabs" role="group" aria-label="Informações do cliente">{[["profile", "Cadastro"], ["orders", `Pedidos (${data.summary.totalOrders})`], ["library", "Produtos e acessos"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
      <div className="customer-drawer-body">
        {tab === "profile" && <><h3>Dados do cadastro</h3><dl className="customer-profile"><div><dt>Nome completo</dt><dd>{data.customer.name}</dd></div><div><dt>E-mail</dt><dd>{data.customer.email}</dd></div><div><dt>Telefone / WhatsApp</dt><dd>{data.customer.phone || "Não informado"}</dd></div><div><dt>Empresa</dt><dd>{data.customer.company || "Não informada"}</dd></div><div><dt>Cliente desde</dt><dd>{date(data.customer.createdAt)}</dd></div></dl><p className="customer-panel-note">O cliente atualiza seu cadastro pela área Meus dados.</p><a className="customer-contact-link" href={`mailto:${encodeURIComponent(data.customer.email)}`}><Mail size={17}/>Abrir e-mail para contato <ArrowUpRight size={16}/></a></>}
        {tab === "orders" && <><h3>Histórico de pedidos</h3>{busy && <p role="status">Atualizando pedidos...</p>}{data.orders.length ? <div className="customer-order-list" aria-busy={busy}>{data.orders.map(order => <article key={order.id}><header><span><strong>#{order.id.slice(-7).toUpperCase()}</strong><small>{date(order.createdAt)}</small></span><span className={`customer-status status-${order.status.toLowerCase()}`}>{orderLabels[order.status] || order.status}</span><strong>{money(order.totalCents, order.currency)}</strong></header><ul>{order.items.map((item, index) => <li key={index}><strong>{item.productName}</strong><small>{productTypeLabel(item.product.type)} · {item.variantName}</small></li>)}</ul></article>)}</div> : <p className="customer-panel-note">Este cliente ainda não fez pedidos.</p>}{data.ordersPagination.pages > 1 && <div className="customer-pagination"><button disabled={busy || page === 1} onClick={() => { setBusy(true); setPage(value => value - 1); }}><ChevronLeft size={17}/>Anterior</button><span>{page} de {data.ordersPagination.pages}</span><button disabled={busy || page >= data.ordersPagination.pages} onClick={() => { setBusy(true); setPage(value => value + 1); }}>Próxima<ChevronRight size={17}/></button></div>}</>}
        {tab === "library" && <><h3>Produtos e acessos</h3><p className="customer-panel-note">O acesso é liberado por uma compra paga. Uma nova compra paga mantém a versão disponível mesmo que um pedido anterior tenha sido reembolsado.</p>{data.library.length ? <div className="customer-access-list">{data.library.map(item => <article key={item.id}><div><PackageOpen size={21}/><span><strong>{item.name}</strong><small>{productTypeLabel(item.type)} · {item.variantName}{item.format ? ` · ${item.format}` : ""}</small>{item.licenseName && <small>{item.licenseName}</small>}</span><span className={`customer-status ${item.access === "AVAILABLE" ? "status-paid" : "status-blocked"}`}>{item.access === "AVAILABLE" ? "Liberado" : "Bloqueado"}</span></div><p>{item.reason} · pedido #{item.orderId.slice(-7).toUpperCase()}</p><small>{item.filesCount ? `${item.filesCount} ${item.filesCount === 1 ? "arquivo cadastrado" : "arquivos cadastrados"}` : "Sem arquivos cadastrados para esta versão"}</small></article>)}</div> : <p className="customer-panel-note">Nenhum produto associado a este cliente.</p>}</>}
      </div>
    </>}
  </dialog>;
}

export default function AdminCustomersPage() {
  const router = useRouter(); const [data, setData] = useState<CustomerList | null>(null); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1); const [error, setError] = useState(""); const [busy, setBusy] = useState(true); const [retry, setRetry] = useState(0); const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ q: query, filter, sort, page: String(page) });
      fetch(`/api/admin/customers?${params}`, { credentials: "include", cache: "no-store", signal: controller.signal }).then(async response => {
        if (response.status === 401) { router.push("/login"); return; } if (response.status === 403) { router.push("/account"); return; }
        const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível carregar os clientes.");
        setData(result); setError("");
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar os clientes."); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, filter, sort, page, retry, router]);
  function reset() { setQuery(""); setFilter("all"); setPage(1); setBusy(true); }
  return <main className="dashboard-shell"><DashboardSidebar admin userName={data?.viewer?.name}/><section className="dashboard-content customers-content">
    <header className="dashboard-topbar"><div><span className="section-index">Relacionamento / Herculano Studios</span><h1>Clientes</h1><p>Conheça quem faz parte do estúdio e acompanhe suas compras e acessos.</p></div></header>
    <div className="customers-metrics">{[{ label: "Clientes cadastrados", value: data?.stats.registered, Icon: UsersRound }, { label: "Clientes com compras", value: data?.stats.buyers, Icon: ShoppingBag }, { label: "Novos clientes no mês", value: data?.stats.newThisMonth, Icon: UserPlus }].map(({ label, value, Icon }) => <article key={label}><span><Icon size={22}/></span><small>{label}</small><strong>{value === undefined ? "—" : String(value).padStart(2, "0")}</strong></article>)}</div>
    <div className="customers-toolbar"><label className="customers-search"><Search size={19}/><span className="sr-only">Buscar clientes</span><input type="search" value={query} placeholder="Buscar por nome, e-mail ou telefone" maxLength={150} onChange={event => { setQuery(event.target.value); setPage(1); setBusy(true); }}/></label><label>Ordenar por<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); setBusy(true); }}><option value="newest">Cadastros mais recentes</option><option value="oldest">Cadastros mais antigos</option><option value="name">Nome: A–Z</option><option value="spent">Maior gasto em BRL</option></select></label></div>
    <div className="customers-filters" role="group" aria-label="Filtrar clientes">{[["all", "Todos"], ["buyers", "Com compras"], ["no_purchases", "Sem compras"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); setBusy(true); }}>{label}</button>)}</div>
    <section className="customers-list-panel" aria-busy={busy}>
      <header className="customers-list-heading"><div><h2>Seu público</h2><p role="status">{busy ? "Atualizando clientes..." : `${data?.pagination.total || 0} ${(data?.pagination.total || 0) === 1 ? "cliente encontrado" : "clientes encontrados"}`}</p></div><span><CircleCheck size={15}/>Compras pagas nos totais</span></header>
      {error ? <div className="customers-state" role="alert"><p>{error}</p><button className="dashboard-cta" onClick={() => { setError(""); setBusy(true); setRetry(value => value + 1); }}>Tentar novamente</button></div> : !data ? <div className="customers-state" role="status"><Clock3 size={28}/><p>Carregando clientes...</p></div> : data.customers.length ? <div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>Cliente</th><th>Cadastro</th><th>Compras pagas</th><th>Total gasto</th><th>Última compra</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{data.customers.map(customer => <tr key={customer.id}><td><button className="customer-name-button" onClick={() => setSelected(customer.id)} disabled={busy}><span className="customer-avatar">{initials(customer.name)}</span><span><strong>{customer.name}</strong><small>{customer.email}</small></span></button></td><td>{date(customer.createdAt)}</td><td><span className={customer.paidOrders ? "customer-buyer-count" : "customer-muted"}>{customer.paidOrders}</span></td><td><Totals totals={customer.totals}/></td><td>{customer.lastPurchaseAt ? date(customer.lastPurchaseAt) : <span className="customer-muted">Sem compras</span>}</td><td><button className="customer-open" aria-label={`Ver detalhes de ${customer.name}`} onClick={() => setSelected(customer.id)} disabled={busy}><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div> : <div className="customers-state"><UsersRound size={36}/><h3>{query || filter !== "all" ? "Nenhum cliente encontrado" : "Seus clientes aparecerão aqui"}</h3><p>{query || filter !== "all" ? "Experimente outra busca ou remova os filtros." : "Os cadastros feitos no site aparecerão nesta lista, mesmo antes da primeira compra."}</p>{(query || filter !== "all") && <button className="dashboard-cta" onClick={reset}>Limpar filtros</button>}</div>}
      {data && data.pagination.pages > 1 && <footer className="customer-pagination"><button disabled={busy || page <= 1} onClick={() => { setPage(value => value - 1); setBusy(true); }}><ChevronLeft size={17}/>Anterior</button><span>Página {page} de {data.pagination.pages}</span><button disabled={busy || page >= data.pagination.pages} onClick={() => { setPage(value => value + 1); setBusy(true); }}>Próxima<ChevronRight size={17}/></button></footer>}
    </section><p className="customers-footnote">Os valores consideram pedidos pagos e são exibidos por moeda. Contas de administradores não entram na lista.</p>
  </section>{selected && <CustomerDrawer key={selected} id={selected} onClose={() => setSelected(null)}/>}<ThemeLab/></main>;
}
