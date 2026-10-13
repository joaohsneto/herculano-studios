"use client";

import { FormEvent, useEffect, useState } from "react";
import { BeatPreviewSelector } from "./beat-preview-selector";
type SavedPreview = { id: string; publicUrl: string; sourceStartSec: number; sourceEndSec: number; durationSec: number };
type EditorData = { preview: SavedPreview | null; source: { fileName: string; url: string } | null };

export function PreviewEditor({ productId }: { productId: string }) {
  const [file, setFile] = useState<File>();
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [saved, setSaved] = useState<EditorData>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = "/api/media/admin/products/" + productId + "/beat-preview";

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { credentials: "include", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Não foi possível carregar a prévia salva.");
      return response.json() as Promise<EditorData>;
    }).then(setSaved).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [endpoint]);

  function choose(next?: File) {
    if (!next) return;
    setFile(next); setRevision(value => value + 1); setSelection({ start: 0, end: 0 }); setMessage("");
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    if ((!file && !saved?.source) || selection.end <= selection.start || saving) return;
    const body = new FormData();
    if (file) body.append("file", file);
    body.append("name", "Prévia da loja"); body.append("startSec", String(selection.start)); body.append("endSec", String(selection.end));
    setSaving(true); setMessage("Gerando prévia...");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "include", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Falha ao gerar prévia.");
      setSaved(previous => ({ preview: data.preview, source: previous?.source ?? null }));
      setMessage("Prévia salva. Você pode voltar a este produto para editar o trecho.");
      const refreshed = await fetch(endpoint, { credentials: "include" });
      if (refreshed.ok) setSaved(await refreshed.json());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão. Tente novamente."); }
    finally { setSaving(false); }
  }
  const preview = saved?.preview;
  return <form className="preview-editor" onSubmit={generate}>
    <div className="admin-section-title"><div><span>Prévia do beat</span><h2>Selecione o trecho público</h2></div><small>Máximo de 30 segundos</small></div>
    {!saved && !message && <p>Carregando prévia salva...</p>}
    {preview && <div className="saved-beat-preview"><strong>Prévia salva · {preview.durationSec.toFixed(1)}s</strong><p>Trecho original: {preview.sourceStartSec.toFixed(1)}s até {preview.sourceEndSec.toFixed(1)}s</p>{!file && !saved?.source && <audio key={preview.id} controls crossOrigin="use-credentials" preload="metadata" src={preview.publicUrl} />}</div>}
    {preview && !saved?.source && !file && <p>O original desta prévia antiga não foi preservado. Envie o WAV ou MP3 uma vez para editar o trecho; ele ficará salvo para as próximas edições.</p>}
    {saved?.source && <p>Original salvo: <strong>{saved.source.fileName}</strong></p>}
    <label className="dropzone">{saved?.source ? "Substituir áudio original (opcional)" : "Escolher WAV ou MP3"}<input disabled={saving} type="file" accept="audio/wav,audio/mpeg,.wav,.mp3" onChange={event => choose(event.target.files?.[0])}/></label>
    {(file || saved?.source) && <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <BeatPreviewSelector key={revision} file={file} sourceUrl={!file && saved?.source ? saved.source.url : undefined} initialRange={!file && preview ? { start: preview.sourceStartSec, end: preview.sourceEndSec } : undefined} value={selection} onChange={setSelection}/>
      <div className="editor-actions"><button className="primary-button" type="submit" disabled={saving || selection.end <= selection.start}>{saving ? "Salvando..." : preview ? "Salvar alterações" : "Gerar preview"} <span>↗</span></button></div>
    </fieldset>}
    <p aria-live="polite">{message}</p>
  </form>;
}
