"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Download, FileText, GraduationCap, Layers, Music2, PackageOpen, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { KitPreviewPlayer } from "@/components/kit-preview-player";
import { ThemeLab } from "@/components/theme-lab";
import { fileSize, filterLibrary, type LibraryItem } from "@/lib/library";
import { productTypeLabel } from "@/lib/product-types";

type Library = { user: { name: string; email: string; role: "ADMIN" | "CUSTOMER" }; items: LibraryItem[] };
const icons = { BEAT: Music2, DRUM_KIT: PackageOpen, SAMPLE_PACK: Layers, PRESET: SlidersHorizontal, COURSE: GraduationCap, EBOOK: BookOpen, TEMPLATE: FileText };

function DownloadFile({ file }: { file: LibraryItem["files"][number] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${file.url}?check=1`, { credentials: "include", cache: "no-store" });
      if (response.status === 401) { router.push("/login"); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível iniciar o download.");
      window.location.assign(new URL(file.url, window.location.origin).href);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível iniciar o download. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="library-file"><div><FileText size={20}/><span><strong>{file.name}</strong><small>{fileSize(file.sizeBytes)}</small></span><button className="library-file-download" type="button" onClick={download} disabled={busy} aria-label={`Baixar ${file.name}`}><Download size={17}/>{busy ? "Aguarde..." : "Baixar"}</button></div>{error && <p className="library-download-error" role="alert">{error} <Link href="/contact">Falar com o estúdio</Link></p>}</div>;
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = icons[item.type as keyof typeof icons] || Layers;
  const updated = item.files.some(file => Date.parse(file.addedAt) > Date.parse(item.purchasedAt));
  return <article className={`owned-product owned-${item.type.toLowerCase()}`}>
    <div className="owned-cover">
      {/* Uploaded covers use our own authenticated product metadata. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.coverUrl && <img src={item.coverUrl} alt="" loading="lazy"/>}
      <div className="owned-cover-top"><span><Icon size={15}/>{productTypeLabel(item.type)}</span>{updated && <span className="library-update">Novo material</span>}</div>
      <div className="owned-cover-art"><Icon size={58} strokeWidth={1}/><span>H<span>•</span>S</span></div>
      <div className="owned-cover-bottom"><span>HERCULANO STUDIOS</span><ShieldCheck size={19}/></div>
    </div>
    <div className="owned-copy">
      <span className="owned-variant">{item.variantName}{item.format && item.format !== item.variantName ? ` · ${item.format}` : ""}</span>
      <h2>{item.name}</h2><p>{item.shortDescription}</p>
      <div className="owned-tags">{item.licenseName && <span>{item.licenseName}</span>}{item.bpm && <span>{item.bpm} BPM</span>}{item.musicalKey && <span>{item.musicalKey}</span>}</div>
      {item.previews[0] && <div className="owned-preview"><KitPreviewPlayer key={item.previews[0].id} name={item.previews[0].name} url={item.previews[0].url}/></div>}
      <div className="owned-purchase"><span>Adquirido em {new Date(item.purchasedAt).toLocaleDateString("pt-BR")}</span><span>{item.files.length} {item.files.length === 1 ? "arquivo" : "arquivos"}</span></div>
      <button type="button" className="dashboard-cta owned-action" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={`content-${item.id}`}><Download size={18}/>{expanded ? "Fechar conteúdo" : item.files.length ? "Arquivos e detalhes" : "Ver detalhes"}<ArrowUpRight size={17}/></button>
      {!item.files.length && <p className="owned-unavailable">O material ainda não foi disponibilizado. <Link href="/contact">Fale com o estúdio.</Link></p>}
    </div>
    {expanded && <div className="owned-details" id={`content-${item.id}`}>
      <h3>Seu conteúdo</h3>
      {item.files.map(file => <DownloadFile key={file.id} file={file}/>)}
      {item.instructions && <div className="owned-instructions"><h3>Como usar</h3><p>{item.instructions}</p></div>}
      <details className="owned-description"><summary>Sobre o produto e sua versão</summary><p>{item.description}</p><p><strong>Versão adquirida:</strong> {item.variantName}{item.licenseName ? ` · ${item.licenseName}` : ""}</p></details>
      {item.previews.length > 1 && <details className="owned-description"><summary>Mais prévias ({item.previews.length - 1})</summary><div className="owned-more-previews">{item.previews.slice(1).map(preview => <KitPreviewPlayer key={preview.id} name={`${preview.group} · ${preview.name}`} url={preview.url}/>)}</div></details>}
    </div>}
  </article>;
}

export default function LibraryPage() {
  const router = useRouter();
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const load = useCallback(() => fetch("/api/account/library", { credentials: "include", cache: "no-store" }).then(async response => {
    if (response.status === 401) { router.push("/login"); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar sua biblioteca.");
    setData(result); setError("");
  }).catch(error => setError(error instanceof Error ? error.message : "Não foi possível carregar sua biblioteca.")), [router]);
  useEffect(() => { void load(); }, [load]);
  if (!data) return <main className="dashboard-loading"><div className="library-loading" role={error ? "alert" : "status"}><PackageOpen size={32}/><p>{error || "Preparando sua biblioteca..."}</p>{error && <button className="dashboard-cta" onClick={load}>Tentar novamente</button>}</div></main>;
  const availableTypes = [...new Set(data.items.map(item => item.type))];
  const items = filterLibrary(data.items, query, type, sort);
  return <main className="dashboard-shell"><DashboardSidebar admin={data.user.role === "ADMIN"} userName={data.user.name}/>
    <section className="dashboard-content library-content">
      <header className="dashboard-topbar library-topbar"><div><span className="section-index">Minha coleção / Herculano Studios</span><h1>Minha biblioteca</h1><p>Seus sons, ideias e próximos passos. Tudo em um só lugar.</p></div><Link className="library-catalog-link" href="/products">Explorar catálogo <ArrowUpRight size={18}/></Link></header>
      <div className="library-summary"><div><PackageOpen size={23}/><span><strong>{data.items.length.toString().padStart(2, "0")}</strong> {data.items.length === 1 ? "produto adquirido" : "produtos adquiridos"}</span></div><span><ShieldCheck size={17}/>Conteúdo vinculado à sua conta</span></div>
      {data.items.length ? <>
        <div className="library-toolbar"><label className="library-search"><Search size={19}/><span className="sr-only">Buscar na biblioteca</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produtos, formatos ou licenças"/></label><label className="library-sort">Ordenar por<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome: A–Z</option></select></label></div>
        <div className="library-filters" role="group" aria-label="Filtrar por tipo de produto"><button type="button" aria-pressed={type === "ALL"} onClick={() => setType("ALL")}>Todos <span>{data.items.length}</span></button>{availableTypes.map(value => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{productTypeLabel(value)} <span>{data.items.filter(item => item.type === value).length}</span></button>)}</div>
        <div className="library-results" role="status">{items.length} {items.length === 1 ? "produto encontrado" : "produtos encontrados"}{(query || type !== "ALL") && <button type="button" onClick={() => { setQuery(""); setType("ALL"); }}><X size={14}/>Limpar filtros</button>}</div>
        {items.length ? <div className="owned-grid">{items.map(item => <LibraryCard key={item.id} item={item}/>)}</div> : <div className="library-empty"><Search size={36}/><h2>Nenhum produto encontrado</h2><p>Experimente outro nome ou remova os filtros.</p><button className="dashboard-cta" onClick={() => { setQuery(""); setType("ALL"); }}>Limpar filtros</button></div>}
      </> : <div className="library-empty"><div className="library-empty-icon"><PackageOpen size={44} strokeWidth={1.3}/></div><span className="section-index">Sua próxima ideia começa aqui</span><h2>Sua coleção está esperando por você.</h2><p>Após a confirmação do pagamento, seus produtos e materiais ficam disponíveis nesta biblioteca.</p><Link className="dashboard-cta" href="/products">Encontrar meu próximo produto <ArrowUpRight size={18}/></Link></div>}
      <footer className="library-help"><span>Precisa de ajuda com um arquivo ou com sua licença?</span><Link href="/contact">Falar com o estúdio <ArrowUpRight size={16}/></Link></footer>
    </section><ThemeLab/>
  </main>;
}
