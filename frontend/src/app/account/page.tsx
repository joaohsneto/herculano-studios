"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, CalendarDays, Download, ReceiptText, ShieldCheck, ShoppingBag } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeLab } from "@/components/theme-lab";

const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
type Dashboard={user:{name:string;email:string;role:"ADMIN"|"CUSTOMER";createdAt:string};orders:Array<{id:string;status:string;totalCents:number;currency:string;createdAt:string}>;library:Array<{productName:string;productSlug:string;variantName:string;format?:string;purchasedAt:string}>};

export default function AccountPage(){
 const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState("");
 useEffect(()=>{fetch(API+"/api/account/dashboard",{credentials:"include"}).then(async r=>{if(r.status===401){window.location.href="/login";return;}if(!r.ok)throw new Error();setData(await r.json());}).catch(()=>setError("Não foi possível carregar sua conta."));},[]);
 if(!data)return <main className="dashboard-loading">{error||"Carregando seu studio..."}</main>;
 const firstName=data.user.name.split(" ")[0];
 return <main className="dashboard-shell"><DashboardSidebar admin={data.user.role==="ADMIN"} userName={data.user.name}/>
  <section className="dashboard-content">
   <header className="dashboard-topbar"><div><span className="section-index">{data.user.role==="ADMIN"?"Administrator account":"Customer account"}</span><h1>Olá, {firstName}.</h1><p>Acompanhe sua biblioteca, pedidos e dados em um só lugar.</p></div><div className="account-chip"><span>{firstName[0]}</span><div><strong>{data.user.name}</strong><small>{data.user.email}</small></div></div></header>
   {data.user.role==="ADMIN"&&<div className="admin-callout"><div><ShieldCheck size={23}/><span><strong>Controles administrativos ativos</strong><small>Gerencie produtos, clientes e vendas do studio.</small></span></div><Link href="/admin/products">Abrir administração <ArrowUpRight size={18}/></Link></div>}
   <div className="metric-grid">
    <article><span><Boxes size={21}/></span><small>Produtos na biblioteca</small><strong>{String(data.library.length).padStart(2,"0")}</strong></article>
    <article><span><ReceiptText size={21}/></span><small>Total de pedidos</small><strong>{String(data.orders.length).padStart(2,"0")}</strong></article>
    <article><span><CalendarDays size={21}/></span><small>Membro desde</small><strong>{new Date(data.user.createdAt).toLocaleDateString("pt-BR",{month:"short",year:"numeric"})}</strong></article>
   </div>
   <section className="dashboard-panel"><header><div><span className="section-index">Minha biblioteca</span><h2>Produtos comprados</h2></div><Link href="/account/library">Ver biblioteca <ArrowUpRight size={17}/></Link></header>
    {data.library.length?<div className="library-list">{data.library.slice(0,4).map((item,index)=><article key={item.productSlug+index}><div className="mini-cover"><span>{item.format??"HS"}</span></div><div><strong>{item.productName}</strong><small>{item.variantName} · comprado em {new Date(item.purchasedAt).toLocaleDateString("pt-BR")}</small></div><button aria-label="Baixar produto"><Download size={20}/></button></article>)}</div>:<div className="empty-state"><ShoppingBag size={30}/><strong>Sua biblioteca ainda está vazia</strong><p>Quando uma compra for confirmada, seus produtos e downloads aparecerão aqui.</p><Link href="/#catalog">Explorar catálogo <ArrowUpRight size={17}/></Link></div>}
   </section>
  </section><ThemeLab/>
 </main>;
}
