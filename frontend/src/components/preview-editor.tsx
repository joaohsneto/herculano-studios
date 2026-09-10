"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PreviewEditor({ productId }: { productId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(12);
  const [message, setMessage] = useState("");
  const width = useMemo(() => duration ? Math.max(0, ((end - start) / duration) * 100) : 0, [duration, start, end]);

  function choose(next?: File) {
    if (!next) return;
    if (url) URL.revokeObjectURL(url);
    const nextUrl = URL.createObjectURL(next);
    setFile(next); setUrl(nextUrl); setStart(0); setEnd(12);
  }

  function playSelection() {
    if (!audio.current) return;
    audio.current.currentTime = start;
    audio.current.play();
    const stop = () => { if (audio.current && audio.current.currentTime >= end) { audio.current.pause(); audio.current.removeEventListener("timeupdate", stop); } };
    audio.current.addEventListener("timeupdate", stop);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append("file", file); body.append("name", "Store preview"); body.append("startSec", String(start)); body.append("endSec", String(end));
    setMessage("Gerando preview...");
    const response = await fetch(API + "/api/media/admin/products/" + productId + "/beat-preview", { method: "POST", credentials: "include", body });
    const data = await response.json();
    setMessage(response.ok ? "Preview gerado e cadastrado." : data.message ?? "Falha ao gerar preview.");
  }

  return (
    <form className="preview-editor" onSubmit={generate}>
      <div className="admin-section-title"><div><span>Beat preview</span><h2>Selecione o trecho público</h2></div><small>Máximo de 30 segundos</small></div>
      <label className="dropzone">Escolher WAV ou MP3<input type="file" accept="audio/wav,audio/mpeg,.wav,.mp3" onChange={(e) => choose(e.target.files?.[0])} /></label>
      {url && <><audio ref={audio} src={url} onLoadedMetadata={(e) => { const value=e.currentTarget.duration; setDuration(value); setEnd(Math.min(12,value)); }} />
        <div className="timeline"><div className="timeline-selection" style={{ left: (start / duration * 100) + "%", width: width + "%" }} /></div>
        <div className="range-grid">
          <label>Início <strong>{start.toFixed(1)}s</strong><input type="range" min="0" max={Math.max(0,end-.5)} step=".1" value={start} onChange={(e)=>setStart(Number(e.target.value))}/></label>
          <label>Fim <strong>{end.toFixed(1)}s</strong><input type="range" min={start+.5} max={duration} step=".1" value={end} onChange={(e)=>setEnd(Number(e.target.value))}/></label>
        </div>
        <div className="editor-actions"><button type="button" onClick={playSelection}>▶ Ouvir seleção</button><button className="primary-button" type="submit">Gerar preview <span>↗</span></button></div>
      </>}
      <p aria-live="polite">{message}</p>
    </form>
  );
}
