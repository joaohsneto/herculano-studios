"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";

function time(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function BeatPreviewCover({ name, url, durationSec, compact = false }: {
  name: string; url?: string; durationSec?: number; compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [error, setError] = useState("");
  useEffect(() => {
    const stop = () => audio.current?.pause();
    // Also stop when a different HTML audio player starts, including kit players.
    const onPlay = (event: Event) => { if (event.target !== audio.current) stop(); };
    document.addEventListener("play", onPlay, true);
    return () => { document.removeEventListener("play", onPlay, true); stop(); };
  }, []);

  async function toggle() {
    const player = audio.current;
    if (!player || loading) return;
    if (!player.paused) { player.pause(); return; }
    setError(""); setLoading(true);
    if (player.ended) player.currentTime = 0;
    try { await player.play(); }
    catch { setError("Não foi possível tocar a prévia. Tente novamente."); }
    finally { setLoading(false); }
  }

  return <div className={`beat-listen${compact ? " beat-listen-compact" : ""}${playing ? " is-playing" : ""}`}>
    <div className="detail-cover beat-artwork">
      <span>HERCULANO STUDIOS</span>
      <strong>{name}</strong>
      <div className="beat-cover-bottom">
        <div className="beat-vinyl" aria-hidden="true"><span>HS</span></div>
        {url ? <button type="button" className="beat-cover-play" onClick={toggle} disabled={loading} aria-label={`${playing ? "Pausar" : "Ouvir"} prévia de ${name}`} aria-pressed={playing}>
          {loading ? <LoaderCircle className="beat-spinner"/> : playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}
          <span>{loading ? "Carregando…" : playing ? "Pausar prévia" : "Ouvir prévia"}</span>
        </button> : <span className="beat-unavailable">Prévia em breve</span>}
      </div>
    </div>
    {url && <>
      <audio ref={audio} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPlaying={() => setLoading(false)} onPause={() => { setPlaying(false); setLoading(false); }} onEnded={() => { setPlaying(false); setLoading(false); }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds)) setDuration(seconds); }} onError={() => { setPlaying(false); setLoading(false); setError("Prévia indisponível no momento. Tente novamente mais tarde."); }}/>
      <div className="beat-player-controls">
        <div className="beat-player-caption"><span>Prévia{duration > 0 ? ` de ${Math.round(duration)} segundos` : " do beat"}</span><span>{time(position)} / {time(duration)}</span></div>
        <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration} aria-label={`Progresso da prévia de ${name}`} aria-valuetext={`${time(position)} de ${time(duration)}`} onChange={event => { const next = Number(event.target.value); if (audio.current) audio.current.currentTime = next; setPosition(next); }}/>
      </div>
    </>}
    {error && <p className="beat-player-error" role="alert">{error}</p>}
  </div>;
}
