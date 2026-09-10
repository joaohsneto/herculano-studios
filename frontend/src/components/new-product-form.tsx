"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { AudioLines, FileArchive, Music2, PackageOpen, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Kind = "BEAT" | "DRUM_KIT";

export function NewProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<Kind>("BEAT");
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
    event.preventDefault(); if (!file) return setMessage(type==="BEAT"?"Selecione o áudio do beat.":"Selecione o ZIP do kit.");
    setSaving(true); setMessage("Salvando produto...");
    const form=new FormData(event.currentTarget); const name=String(form.get("name")); const slug=String(form.get("slug"));
    const formats=type==="BEAT"?["MP3","WAV"]:["ZIP"];
    const prices=type==="BEAT"?[Number(form.get("mp3Price")),Number(form.get("wavPrice"))]:[Number(form.get("price"))];
    const response=await fetch(API+"/api/products",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name,slug,type,shortDescription:String(form.get("shortDescription")),description:String(form.get("description")),featured:false,
      variants:formats.map((format,index)=>({name:format==="ZIP"?"Complete Kit":format,sku:(slug+"-"+format+"-"+Date.now()).toUpperCase(),format,licenseName:format==="ZIP"?"Royalty Free":"Licença "+format,priceCents:Math.round(prices[index]*100),currency:"BRL"}))
    })});
    const data=await response.json();
    if(!response.ok){setSaving(false);return setMessage(data.message??"Não foi possível cadastrar.");}
    setMessage(type==="BEAT"?"Gerando o trecho escolhido...":"Extraindo dois previews de cada pasta...");
    const upload=new FormData(); upload.append("file",file);
    let endpoint="";
    if(type==="BEAT"){upload.append("name",name);upload.append("startSec",String(start));upload.append("endSec",String(end));endpoint="/beat-preview";}
    else endpoint="/drum-kit-previews";
    const media=await fetch(API+"/api/media/admin/products/"+data.product.id+endpoint,{method:"POST",credentials:"include",body:upload});
    const result=await media.json();
    if(!media.ok){setSaving(false);return setMessage("Cadastro cancelado: "+(result.message??"erro desconhecido"));}
    await fetch(API+"/api/products/"+data.product.id+"/publish",{method:"PATCH",credentials:"include"});
    setMessage(result.message??"Produto e previews cadastrados."); setSaving(false); setTimeout(onCreated,700);
  }

  return <div className="modal-backdrop" role="presentation"><form className="product-modal product-form" onSubmit={submit}>
    <header className="modal-header"><div><span className="section-index">Novo produto</span><h2>Cadastrar no catálogo</h2><p>Escolha o tipo para abrir os campos corretos.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X/></button></header>
    <div className="product-type-picker">
      <button type="button" className={type==="BEAT"?"active":""} onClick={()=>changeType("BEAT")}><Music2/><span><strong>Beat</strong><small>MP3 + WAV e trecho com minutagem</small></span></button>
      <button type="button" className={type==="DRUM_KIT"?"active":""} onClick={()=>changeType("DRUM_KIT")}><PackageOpen/><span><strong>Drum Kit</strong><small>ZIP e 2 previews automáticos por pasta</small></span></button>
    </div>
    <section className="form-section"><h3>01. Informações do produto</h3><div className="form-grid">
      <label>Nome<input name="name" required minLength={2} placeholder={type==="BEAT"?"Ex.: Afrobeat Type...":"Ex.: Brazilian Funk Essentials"}/></label>
      <label>Slug<input name="slug" required pattern="[a-z0-9-]+" placeholder="nome-do-produto"/></label>
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

