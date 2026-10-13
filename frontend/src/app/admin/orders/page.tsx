"use client";

import { useEffect, useState } from "react";
import { BarChart3, CircleDollarSign, PackageCheck, ShoppingCart } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeLab } from "@/components/theme-lab";

type Overview={stats:{products:number;orders:number;customers:number;revenueCents:number};recentOrders:Array<{id:string;status:string;totalCents:number;currency:string;createdAt:string;user:{name:string;email:string};items:Array<{productName:string}>}>};
const orderStatusLabels: Record<string, string> = { PENDING: "Pendente", PAID: "Pago", CANCELLED: "Cancelado", REFUNDED: "Reembolsado" };
export default function AdminOrdersPage(){
 const [data,setData]=useState<Overview|null>(null);
 useEffect(()=>{fetch("/api/admin/overview",{credentials:"include"}).then(async r=>{if(!r.ok){window.location.href="/login";return;}setData(await r.json());});},[]);
 if(!data)return <main className="dashboard-loading">Carregando vendas...</main>;
 return <main className="dashboard-shell"><DashboardSidebar admin userName="Administrador"/>
  <section className="dashboard-content"><header className="dashboard-topbar"><div><span className="section-index">Gestão de vendas</span><h1>Vendas</h1><p>Acompanhe pedidos, receita e clientes.</p></div></header>
   <div className="metric-grid admin-metrics"><article><span><CircleDollarSign size={22}/></span><small>Receita total</small><strong>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(data.stats.revenueCents/100)}</strong></article><article><span><ShoppingCart size={22}/></span><small>Pedidos</small><strong>{data.stats.orders}</strong></article><article><span><PackageCheck size={22}/></span><small>Produtos</small><strong>{data.stats.products}</strong></article><article><span><BarChart3 size={22}/></span><small>Clientes</small><strong>{data.stats.customers}</strong></article></div>
   <section className="dashboard-panel orders-panel"><header><div><span className="section-index">Pedidos recentes</span><h2>Movimentação da loja</h2></div></header>
    {data.recentOrders.length?<div className="orders-table">{data.recentOrders.map(order=><div key={order.id}><span>#{order.id.slice(-7).toUpperCase()}</span><span><strong>{order.user.name}</strong><small>{order.user.email}</small></span><span>{order.items[0]?.productName??"Pedido"}</span><span className={"status "+order.status.toLowerCase()}>{orderStatusLabels[order.status] ?? "Situação desconhecida"}</span><b>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:order.currency}).format(order.totalCents/100)}</b></div>)}</div>:<div className="empty-state"><ShoppingCart size={30}/><strong>Nenhuma venda registrada</strong><p>Os novos pedidos aparecerão aqui assim que o checkout estiver ativo.</p></div>}
   </section>
  </section><ThemeLab/>
 </main>;
}
