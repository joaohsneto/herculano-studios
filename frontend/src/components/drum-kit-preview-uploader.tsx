"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileArchive, RefreshCw, UploadCloud, X } from "lucide-react";
import { KitPreviewPlayer } from "./kit-preview-player";

type Preview = { id: string; name: string; publicUrl: string; storageKey: string };
type Candidate = { entry: string; name: string; selected: boolean };
type Group = { id: string; name: string; items: Preview[]; candidates: Candidate[] };
type Catalog = { sourceAvailable: boolean; groups: Group[] };

export function DrumKitPreviewUploader({ productId }: { productId: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState<{ group: Group; preview: Preview } | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [audition, setAudition] = useState("");
  const [limit, setLimit] = useState(100);
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const base = `/api/media/admin/products/${productId}/drum-kit-previews`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(base, { credentials: "include", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível carregar as prévias.");
      setLoadError(""); setCatalog(data);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as prévias."); }
  }, [base]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; }; }, [load]);
  useEffect(() => {
    if (choice) dialog.current?.showModal();
    else dialog.current?.close();
  }, [choice]);
  useEffect(() => {
    const onPlay = (event: Event) => { if (event.target !== audio.current) audio.current?.pause(); };
    document.addEventListener("play", onPlay, true);
    return () => { document.removeEventListener("play", onPlay, true); };
  }, []);

  function close() { if (busy) return; audio.current?.pause(); setChoice(null); setAudition(""); }
  function open(group: Group, preview: Preview) {
    setQuery(""); setSelected(""); setAudition(""); setMessage(""); setLimit(100); setChoice({ group, preview });
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("Lendo o ZIP e preparando os sons...");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(base, { method: "POST", credentials: "include", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível processar o ZIP.");
      setMessage(data.message); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível processar o ZIP."); }
    finally { setBusy(false); }
  }
  async function replace(preview: Preview, entry?: string) {
    audio.current?.pause(); setBusy(true); setMessage("Preparando a nova prévia. A anterior continua disponível...");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(preview.id)}/replacement`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry, random: !entry, expectedKey: preview.storageKey }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setChoice(null); await load(); }
        throw new Error(data.message || "Não foi possível trocar a prévia.");
      }
      setMessage(data.message); setChoice(null); setAudition(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível trocar a prévia."); if (!choice) await load(); }
    finally { setBusy(false); }
  }
  async function listen(candidate: Candidate) {
    const player = audio.current;
    if (!player) return;
    setAudition(candidate.name); setMessage("");
    player.src = `${base}/audition?entry=${encodeURIComponent(candidate.entry)}`;
    try { await player.play(); }
    catch { setMessage("Não foi possível ouvir este som. Tente novamente."); }
  }
  const candidates = choice?.group.candidates.filter(candidate => candidate.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) ?? [];

  return <section className="kit-preview-manager" aria-label="Prévias do drum kit">
    <div className="kit-inspector-note"><FileArchive/><div><strong>Prévias do drum kit</strong><span>Dois sons por pasta. Ouça e troque cada prévia sem alterar a outra.</span></div></div>
    {loadError ? <p role="alert">{loadError} <button type="button" onClick={() => void load()}>Tentar novamente</button></p> : !catalog ? <p role="status">Carregando prévias...</p> : <>
      {(!catalog.sourceAvailable || !catalog.groups.some(group => group.items.length)) && <div className="kit-source-note"><p>{catalog.groups.some(group => group.items.length) ? "Envie o ZIP original para habilitar as trocas. As prévias atuais serão mantidas." : "Envie o ZIP para sortear até duas prévias por pasta."}</p><label className="inspector-upload"><UploadCloud/>{busy ? "Processando..." : "Selecionar ZIP original"}<input type="file" accept=".zip,application/zip" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }}/></label></div>}
      {catalog.groups.map(group => <div className="kit-admin-group" key={group.id}><h3>{group.name}</h3>{group.items.map(preview => <div className="kit-admin-preview" key={preview.id}><KitPreviewPlayer name={preview.name} url={preview.publicUrl}/><div className="kit-preview-actions"><button type="button" disabled={busy || !catalog.sourceAvailable || !group.candidates.some(item => !item.selected)} onClick={() => open(group, preview)}>Trocar som</button><button type="button" disabled={busy || !catalog.sourceAvailable || !group.candidates.some(item => !item.selected)} onClick={() => void replace(preview)}><RefreshCw size={14}/>Sortear outro</button></div></div>)}{catalog.sourceAvailable && !group.candidates.some(item => !item.selected) && <small>Todos os sons desta pasta já estão nas prévias.</small>}</div>)}
    </>}
    {!choice && <p role="status" className="kit-manager-message">{message}</p>}
    <dialog ref={dialog} className="kit-choice-dialog" aria-labelledby="kit-choice-title" onCancel={event => { event.preventDefault(); close(); }}>
      {choice && <><header><div><span className="section-index">{choice.group.name}</span><h2 id="kit-choice-title">Trocar som da prévia</h2><p>Substituir: {choice.preview.name}</p></div><button type="button" aria-label="Fechar seleção de som" disabled={busy} onClick={close}><X/></button></header>
        <label className="kit-choice-search">Buscar nesta pasta<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(100); }} placeholder="Nome do som" disabled={busy}/></label>
        <div className="kit-audition"><span>{audition ? `Ouvindo: ${audition}` : "Ouça um som antes de escolher. Audição exclusiva do administrador."}</span><audio ref={audio} controls preload="none" onError={() => setMessage("Não foi possível ouvir este som. Tente outro arquivo.")}/></div>
        <fieldset className="kit-candidate-list" disabled={busy}><legend className="sr-only">Escolha o novo som</legend>{candidates.slice(0, limit).map(candidate => <div key={candidate.entry} className={selected === candidate.entry ? "selected" : ""}><label><input type="radio" name="kit-preview-candidate" value={candidate.entry} checked={selected === candidate.entry} disabled={candidate.selected} onChange={() => setSelected(candidate.entry)}/><span>{candidate.name}{candidate.selected && <small>Já está nas prévias</small>}</span></label><button type="button" onClick={() => void listen(candidate)} aria-label={`Ouvir ${candidate.name}`}>Ouvir</button></div>)}{!candidates.length && <p>Nenhum som encontrado nesta pasta.</p>}{candidates.length > limit && <button type="button" onClick={() => setLimit(value => value + 100)}>Mostrar mais sons</button>}</fieldset>
        <p role="status" className="kit-manager-message">{message}</p><footer><button type="button" disabled={busy} onClick={close}>Cancelar</button><button type="button" className="dashboard-cta" disabled={busy || !selected} onClick={() => void replace(choice.preview, selected)}>{busy ? "Preparando prévia..." : "Usar como prévia"}</button></footer>
      </>}
    </dialog>
  </section>;
}
