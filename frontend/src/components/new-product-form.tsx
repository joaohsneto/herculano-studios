"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { AudioLines, FileArchive, Music2, PackageOpen, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Kind = "BEAT" | "DRUM_KIT";
const CREATE_TIMEOUT_MS = 30_000;
const PROCESSING_TIMEOUT_MS = 3 * 60_000;

async function requestWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A operação demorou mais que o esperado. Verifique a API e tente novamente.");
    }
    if (error instanceof TypeError) {
      throw new Error("Não foi possível conectar ao servidor. Atualize a página e tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function responseBody(response: Response) {
  return response.json().catch(() => ({})) as Promise<{ message?: string; product?: { id: string } }>;
}

const makeSlug = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export function NewProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<Kind>("BEAT");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [file, setFile] = useState<File>();
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(12);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const selectionWidth = useMemo(() => duration ? ((end - start) / duration) * 100 : 0, [duration,start,end]);

  function selectFile(next?: File) {
    if (!next) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(next);
    if (type === "BEAT") setAudioUrl(URL.createObjectURL(next));
  }
  function changeType(next: Kind) { setType(next); setFile(undefined); setAudioUrl(""); setMessage(""); }
  function playSelection() {
    if (!audio.current) return; audio.current.currentTime=start; void audio.current.play();
    const stop=()=>{if(audio.current&&audio.current.currentTime>=end){audio.current.pause();audio.current.removeEventListener("timeupdate",stop);}};
    audio.current.addEventListener("timeupdate",stop);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage(type === "BEAT" ? "Selecione o áudio do beat." : "Selecione o ZIP do kit.");

    let productId: string | undefined;
    setSaving(true);
    setMessage("Salvando produto...");

    try {
      const form = new FormData(event.currentTarget);
      const productName = String(form.get("name"));
      const productSlug = String(form.get("slug"));
      const formats = type === "BEAT" ? ["MP3", "WAV"] : ["ZIP"];
      const prices = type === "BEAT"
        ? [Number(form.get("mp3Price")), Number(form.get("wavPrice"))]
        : [Number(form.get("price"))];
      const response = await requestWithTimeout(API + "/api/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productName,
          slug: productSlug,
          type,
          shortDescription: String(form.get("shortDescription")),
          description: String(form.get("description")),
          featured: false,
          variants: formats.map((format, index) => ({
            name: format === "ZIP" ? "Complete Kit" : format,
            sku: (productSlug + "-" + format + "-" + Date.now()).toUpperCase(),
            format,
            licenseName: format === "ZIP" ? "Royalty Free" : "Licença " + format,
            priceCents: Math.round(prices[index] * 100),
            currency: "BRL"
          }))
        })
      }, CREATE_TIMEOUT_MS);
      const data = await responseBody(response);
      if (!response.ok || !data.product?.id) throw new Error(data.message ?? "Não foi possível cadastrar o produto.");

      productId = data.product.id;
      setMessage(type === "BEAT" ? "Gerando o trecho escolhido..." : "Extraindo dois previews de cada pasta...");
      const upload = new FormData();
      upload.append("file", file);
      let endpoint = "/drum-kit-previews";
      if (type === "BEAT") {
        upload.append("name", productName);
        upload.append("startSec", String(start));
        upload.append("endSec", String(end));
        endpoint = "/beat-preview";
      }

      const media = await requestWithTimeout(API + "/api/media/admin/products/" + productId + endpoint, {
        method: "POST",
        credentials: "include",
        body: upload
      }, PROCESSING_TIMEOUT_MS);
      const result = await responseBody(media);
      if (!media.ok) throw new Error(result.message ?? "Não foi possível gerar os previews.");

      const publish = await requestWithTimeout(API + "/api/products/" + productId + "/publish", {
        method: "PATCH",
        credentials: "include"
      }, CREATE_TIMEOUT_MS);
      const published = await responseBody(publish);
      if (!publish.ok) throw new Error(published.message ?? "Os previews foram criados, mas não foi possível publicar o produto.");

      setMessage(result.message ?? "Produto e previews cadastrados.");
      window.setTimeout(onCreated, 700);
    } catch (error) {
      if (productId) {
        await fetch(API + "/api/products/" + productId, { method: "DELETE", credentials: "include" }).catch(() => undefined);
      }
      const detail = error instanceof Error ? error.message : "erro desconhecido";
      setMessage("Cadastro cancelado: " + detail);
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" role="presentation"><form className="product-modal product-form" onSubmit={submit}>
    <header className="modal-header"><div><span className="section-index">Novo produto</span><h2>Cadastrar no catálogo</h2><p>Escolha o tipo para abrir os campos corretos.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X/></button></header>
    <div className="product-type-picker">
      <button type="button" className={type==="BEAT"?"active":""} onClick={()=>changeType("BEAT")}><Music2/><span><strong>Beat</strong><small>MP3 + WAV e trecho com minutagem</small></span></button>
      <button type="button" className={type==="DRUM_KIT"?"active":""} onClick={()=>changeType("DRUM_KIT")}><PackageOpen/><span><strong>Drum Kit</strong><small>ZIP e 2 previews automáticos por pasta</small></span></button>
    </div>
    <section className="form-section"><h3>01. Informações do produto</h3><div className="form-grid">
      <label>Nome<input name="name" required minLength={2} value={name} onChange={event=>{const next=event.target.value;setName(next);if(!slugEdited)setSlug(makeSlug(next));}} placeholder={type==="BEAT"?"Ex.: Afrobeat Type...":"Ex.: Brazilian Funk Essentials"}/></label>
      <label>Slug<input name="slug" required pattern="[a-z0-9-]+" value={slug} onChange={event=>{setSlug(makeSlug(event.target.value));setSlugEdited(true);}} placeholder="nome-do-produto"/></label>
      <label className="form-wide">Descrição curta<input name="shortDescription" required minLength={10}/></label>
      <label className="form-wide">Descrição completa<textarea name="description" required minLength={20} rows={4}/></label>
    </div></section>
    <section className="form-section"><h3>02. Preço e arquivo</h3>
      {type==="BEAT"?<div className="form-grid"><label>Preço MP3 (R$)<input name="mp3Price" type="number" step=".01" min="1" required/></label><label>Preço WAV (R$)<input name="wavPrice" type="number" step=".01" min="1" required/></label></div>:<div className="form-grid"><label>Preço do kit (R$)<input name="price" type="number" step=".01" min="1" required/></label><div className="form-note"><FileArchive/><span>O ZIP completo será armazenado em área privada.</span></div></div>}
      <label className="upload-card"><UploadCloud/><span><strong>{file?.name??(type==="BEAT"?"Escolher WAV ou MP3":"Escolher arquivo ZIP")}</strong><small>{type==="BEAT"?"Arquivo original para gerar o preview":"As pastas internas serão usadas como categorias"}</small></span><input type="file" accept={type==="BEAT"?"audio/wav,audio/mpeg,.wav,.mp3":".zip,application/zip"} onChange={e=>selectFile(e.target.files?.[0])}/></label>
    </section>
    {type==="BEAT"&&audioUrl&&<section className="form-section preview-step"><h3>03. Escolha o trecho público</h3><audio ref={audio} src={audioUrl} onLoadedMetadata={e=>{const d=e.currentTarget.duration;setDuration(d);setEnd(Math.min(12,d));}}/>
      <div className="timeline"><div className="timeline-selection" style={{left:(start/duration*100)+"%",width:selectionWidth+"%"}}/></div>
      <div className="range-grid"><label>Início <strong>{start.toFixed(1)}s</strong><input type="range" min="0" max={Math.max(0,end-.5)} step=".1" value={start} onChange={e=>setStart(Number(e.target.value))}/></label><label>Fim <strong>{end.toFixed(1)}s</strong><input type="range" min={start+.5} max={duration} step=".1" value={end} onChange={e=>setEnd(Number(e.target.value))}/></label></div>
      <button type="button" className="preview-listen" onClick={playSelection}><AudioLines/> Ouvir seleção</button>
    </section>}
    {type==="DRUM_KIT"&&file&&<div className="kit-processing-note"><FileArchive/><div><strong>Processamento automático</strong><span>Serão geradas até 2 amostras curtas de cada pasta encontrada no ZIP.</span></div></div>}
    <p className="form-message" aria-live="polite">{message}</p>
    <footer className="modal-footer"><button type="button" onClick={onClose}>Cancelar</button><button type="submit" disabled={saving}>{saving?"Processando...":"Cadastrar produto →"}</button></footer>
  </form></div>;
}
