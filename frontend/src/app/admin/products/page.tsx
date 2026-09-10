"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, ChevronRight, FileAudio, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NewProductForm } from "@/components/new-product-form";
import { PreviewEditor } from "@/components/preview-editor";
import { ThemeLab } from "@/components/theme-lab";
import { DrumKitPreviewUploader } from "@/components/drum-kit-preview-uploader";
import type { StoreProduct } from "@/components/product-card";

const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
export default function AdminProductsPage(){
 const [products,setProducts]=useState<StoreProduct[]>([]); const [selected,setSelected]=useState(""); const [userName,setUserName]=useState(""); const [modal,setModal]=useState(false); const [status,setStatus]=useState("Carregando catálogo...");
 const load=useCallback(()=>{Promise.all([fetch(API+"/api/auth/me",{credentials:"include"}),fetch(API+"/api/products",{credentials:"include"})]).then(async([me,catalog])=>{if(!me.ok){window.location.href="/login";return;}const account=await me.json();if(account.user.role!=="ADMIN"){window.location.href="/account";return;}const data=await catalog.json();setUserName(account.user.name);setProducts(data.products);setSelected(current=>current||data.products[0]?.id||"");setStatus("");}).catch(()=>setStatus("API indisponível."));},[]);
 useEffect(()=>load(),[load]);
 const current=products.find(product=>product.id===selected);
 return <main className="dashboard-shell"><DashboardSidebar admin userName={userName}/>
  <section className="dashboard-content admin-products-page">
   <header className="dashboard-topbar"><div><span className="section-index">Catalog manager</span><h1>Produtos</h1><p>Cadastre produtos, preços, arquivos e previews.</p></div><button className="primary-button dashboard-cta" onClick={()=>setModal(true)}>Novo produto <PackagePlus size={19}/></button></header>
   <div className="catalog-toolbar"><div className="catalog-search"><Search size={20}/><input placeholder="Buscar no catálogo"/></div><div className="catalog-toolbar-meta"><button><SlidersHorizontal size={19}/>Filtros</button><span>{products.length} produtos</span></div></div>
   <div className="admin-catalog-layout"><section className="product-manager-list">
    <header><span>Produto</span><span>Formato / preço</span><span>Status</span><i/></header>
    {products.map(product=><button key={product.id} className={selected===product.id?"selected":""} onClick={()=>setSelected(product.id)}><span className="product-primary"><i className="product-manager-icon">{product.type==="BEAT"?<FileAudio size={22}/>:<Box size={22}/>}</i><span><strong>{product.name}</strong><small>{product.type.replace("_"," ")}</small></span></span><span className="product-variants">{product.variants.map(v=><small key={v.id}>{v.name} · {new Intl.NumberFormat("pt-BR",{style:"currency",currency:v.currency}).format(v.priceCents/100)}</small>)}</span><b>Ativo</b><ChevronRight size={20}/></button>)}
    {!products.length&&!status&&<div className="empty-state"><Box size={30}/><strong>Nenhum produto</strong><p>Cadastre o primeiro produto para começar.</p></div>}<p>{status}</p>
   </section>
   <aside className="product-inspector"><span className="section-index">Produto selecionado</span><h2>{current?.name??"Selecione um produto"}</h2>{current&&<><p>{current.shortDescription}</p><div className="inspector-data"><span>Tipo<strong>{current.type.replace("_"," ")}</strong></span><span>Variações<strong>{current.variants.length}</strong></span></div>{current.type==="BEAT"?<PreviewEditor productId={current.id}/>:<DrumKitPreviewUploader productId={current.id}/>}</>}</aside>
   </div>
  </section>{modal&&<NewProductForm onClose={()=>setModal(false)} onCreated={()=>{setModal(false);load();}}/>}<ThemeLab/>
 </main>;
}
