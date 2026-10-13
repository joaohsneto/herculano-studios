"use client";

import { FormEvent, useState } from "react";
import { FileArchive, Music2, PackageOpen, UploadCloud, X } from "lucide-react";

import { BeatPreviewSelector } from "./beat-preview-selector";

import { productTypes, type ProductType } from "@/lib/product-types";
type Kind = ProductType;
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
  return response.json().catch(() => ({})) as Promise<{ message?: string; product?: { id: string; variants: Array<{ id: string; format?: string }> } }>;
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
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const { start, end } = selection;
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  function selectFile(next?: File) {
    if (!next) return;
    setFile(next); setRevision(value => value + 1); setSelection({ start: 0, end: 0 });
  }
  function changeType(next: Kind) { setType(next); setFile(undefined); setSelection({ start: 0, end: 0 }); setMessage(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage(type === "BEAT" ? "Selecione o áudio do beat." : "Selecione o arquivo do produto.");

    if (type === "BEAT" && end <= start) return setMessage("Aguarde o áudio carregar e selecione um trecho válido.");

    let productId: string | undefined;
    setSaving(true);
    setMessage("Salvando produto...");

    try {
      const form = new FormData(event.currentTarget);
      const productName = String(form.get("name"));
      const productSlug = String(form.get("slug"));
      const formats = type === "BEAT" ? ["MP3", "WAV"] : [type === "DRUM_KIT" ? "ZIP" : String(form.get("format") || file.name.split(".").pop() || "DIGITAL").toUpperCase()];
      const prices = type === "BEAT"
        ? [Number(form.get("mp3Price")), Number(form.get("wavPrice"))]
        : [Number(form.get("price"))];
      const response = await requestWithTimeout("/api/products", {
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
          deliveryInstructions: String(form.get("deliveryInstructions") || ""),
          variants: formats.map((format, index) => ({
            name: type === "DRUM_KIT" ? "Kit completo" : type === "BEAT" ? format : "Conteúdo completo",
            sku: (productSlug + "-" + format + "-" + Date.now()).toUpperCase(),
            format,
            licenseName: type === "BEAT" ? "Licença " + format : type === "DRUM_KIT" ? "Royalty Free" : String(form.get("licenseName") || "Uso pessoal"),
            priceCents: Math.round(prices[index] * 100),
            currency: "BRL"
          }))
        })
      }, CREATE_TIMEOUT_MS);
      const data = await responseBody(response);
      if (!response.ok || !data.product?.id) throw new Error(data.message ?? "Não foi possível cadastrar o produto.");

      productId = data.product.id;
      let result: { message?: string } = {};
      if (type === "BEAT" || type === "DRUM_KIT") {
        setMessage(type === "BEAT" ? "Gerando o trecho escolhido..." : "Extraindo duas prévias de cada pasta...");
        const upload = new FormData(); upload.append("file", file);
        let endpoint = "/drum-kit-previews";
        if (type === "BEAT") {
          upload.append("name", productName); upload.append("startSec", String(start)); upload.append("endSec", String(end)); endpoint = "/beat-preview";
        }
        const media = await requestWithTimeout("/api/media/admin/products/" + productId + endpoint, { method: "POST", credentials: "include", body: upload }, PROCESSING_TIMEOUT_MS);
        result = await responseBody(media);
        if (!media.ok) throw new Error(result.message ?? "Não foi possível gerar as prévias.");
      }
      setMessage("Salvando o arquivo para a biblioteca...");
      // A beat's original is delivered only to its matching format, never to every license.
      const variant = type === "BEAT" ? data.product.variants.find(item => item.format?.toLowerCase() === file.name.split(".").pop()?.toLowerCase()) : data.product.variants[0];
      if (!variant) throw new Error("O formato do arquivo precisa corresponder à versão cadastrada.");
      const delivery = new FormData(); delivery.append("file", file); delivery.append("kind", "DOWNLOAD"); delivery.append("variantId", variant.id);
      const uploaded = await requestWithTimeout("/api/media/admin/products/" + productId + "/assets", { method: "POST", credentials: "include", body: delivery }, PROCESSING_TIMEOUT_MS);
      const uploadResult = await responseBody(uploaded);
      if (!uploaded.ok) throw new Error(uploadResult.message || "Não foi possível salvar o arquivo para download.");

      const publish = await requestWithTimeout("/api/products/" + productId + "/publish", {
        method: "PATCH",
        credentials: "include"
      }, CREATE_TIMEOUT_MS);
      const published = await responseBody(publish);
      if (!publish.ok) throw new Error(published.message ?? "Os arquivos foram salvos, mas não foi possível publicar o produto.");

      setMessage(result.message ?? "Produto e conteúdo cadastrados.");
      window.setTimeout(onCreated, 700);
    } catch (error) {
      if (productId) {
        await fetch("/api/products/" + productId, { method: "DELETE", credentials: "include" }).catch(() => undefined);
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
      <button type="button" className={type==="DRUM_KIT"?"active":""} onClick={()=>changeType("DRUM_KIT")}><PackageOpen/><span><strong>Drum Kit</strong><small>ZIP e 2 prévias automáticas por pasta</small></span></button>
    </div>
    <section className="form-section"><label>Tipo de produto<select value={type} onChange={event => changeType(event.target.value as Kind)}>{Object.entries(productTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></section>
    <section className="form-section"><h3>01. Informações do produto</h3><div className="form-grid">
      <label>Nome<input name="name" required minLength={2} value={name} onChange={event=>{const next=event.target.value;setName(next);if(!slugEdited)setSlug(makeSlug(next));}} placeholder={type==="BEAT"?"Ex.: Afrobeat Type...":"Ex.: Brazilian Funk Essentials"}/></label>
      <label>Endereço do produto<input name="slug" required pattern="[a-z0-9-]+" value={slug} onChange={event=>{setSlug(makeSlug(event.target.value));setSlugEdited(true);}} placeholder="nome-do-produto"/></label>
      <label className="form-wide">Descrição curta<input name="shortDescription" required minLength={10}/></label>
      <label className="form-wide">Descrição completa<textarea name="description" required minLength={20} rows={4}/></label>
    </div></section>
    <section className="form-section"><h3>02. Preço e arquivo</h3>
      {type==="BEAT"?<div className="form-grid"><label>Preço MP3 (R$)<input name="mp3Price" type="number" step=".01" min="1" required/></label><label>Preço WAV (R$)<input name="wavPrice" type="number" step=".01" min="1" required/></label></div>:<div className="form-grid"><label>Preço do produto (R$)<input name="price" type="number" step=".01" min="1" required/></label><div className="form-note"><FileArchive/><span>O conteúdo será armazenado em área privada e entregue pela biblioteca.</span></div></div>}
      {type !== "BEAT" && type !== "DRUM_KIT" && <div className="form-grid"><label>Formato<input name="format" maxLength={30} placeholder="PDF, ZIP, MP4..."/></label><label>Licença / acesso<input name="licenseName" maxLength={150} placeholder="Uso pessoal"/></label></div>}
      <label className="form-wide">Instruções para o comprador<textarea name="deliveryInstructions" maxLength={10000} rows={3} placeholder="Como abrir os arquivos, instalar ou acessar o conteúdo"/></label>
      <label className="upload-card"><UploadCloud/><span><strong>{file?.name??(type==="BEAT"?"Escolher WAV ou MP3":type==="DRUM_KIT"?"Escolher arquivo ZIP":"Escolher arquivo do produto")}</strong><small>{type==="BEAT"?"O original será entregue à versão correspondente. Envie os demais formatos no painel.":type==="DRUM_KIT"?"As pastas internas serão usadas como categorias":"PDF, ZIP, vídeos, templates e outros materiais digitais"}</small></span><input type="file" accept={type==="BEAT"?"audio/wav,audio/mpeg,.wav,.mp3":type==="DRUM_KIT"?".zip,application/zip":undefined} onChange={e=>selectFile(e.target.files?.[0])}/></label>
    </section>
    {type==="BEAT"&&file&&<section className="form-section preview-step"><h3>03. Escolha o trecho público</h3>
      <BeatPreviewSelector key={revision} file={file} value={selection} onChange={setSelection}/>
    </section>}
    {type==="DRUM_KIT"&&file&&<div className="kit-processing-note"><FileArchive/><div><strong>Processamento automático</strong><span>Serão geradas até 2 amostras curtas de cada pasta encontrada no ZIP.</span></div></div>}
    <p className="form-message" aria-live="polite">{message}</p>
    <footer className="modal-footer"><button type="button" onClick={onClose}>Cancelar</button><button type="submit" disabled={saving}>{saving?"Processando...":"Cadastrar produto →"}</button></footer>
  </form></div>;
}
