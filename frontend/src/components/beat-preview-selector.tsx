"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Play, Square } from "lucide-react";
import { movePreviewRange, type PreviewRange, type RangePart } from "@/lib/preview-range";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;

export function BeatPreviewSelector({ file, sourceUrl, initialRange, value, onChange }: {
  file?: File; sourceUrl?: string; initialRange?: PreviewRange; value: PreviewRange; onChange: (range: PreviewRange) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const attempt = useRef(0);
  const drag = useRef<{ part: RangePart; x: number; width: number; range: PreviewRange } | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const player = audio.current!;
    const playbackAttempt = attempt;
    const url = file ? URL.createObjectURL(file) : sourceUrl!;
    player.src = url;
    return () => {
      playbackAttempt.current++;
      cancelAnimationFrame(frame.current);
      player.pause();
      player.removeAttribute("src");
      player.load();
      if (file) URL.revokeObjectURL(url);
    };
  }, [file, sourceUrl]);

  function stop() {
    attempt.current++;
    cancelAnimationFrame(frame.current);
    audio.current?.pause();
    setPlaying(false);
  }
  function change(next: PreviewRange) { stop(); onChange(next); }
  async function toggle() {
    const player = audio.current;
    if (!player || !duration) return;
    if (playing) return stop();
    const id = ++attempt.current;
    setError("");
    player.currentTime = value.start;
    setPlaying(true);
    try {
      await player.play();
      if (id !== attempt.current) return;
      const tick = () => {
        if (id !== attempt.current) return;
        if (player.currentTime >= value.end || player.ended) { stop(); return; }
        frame.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      if (id === attempt.current) { stop(); setError("Não foi possível ouvir este arquivo. Tente outro WAV ou MP3."); }
    }
  }
  function begin(event: PointerEvent<HTMLButtonElement>, part: RangePart) {
    if (!duration || !track.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    stop();
    drag.current = { part, x: event.clientX, width: track.current.getBoundingClientRect().width, range: value };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    onChange(movePreviewRange(current.range, current.part, (event.clientX - current.x) / current.width * duration, duration));
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, part: RangePart) {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (direction) { event.preventDefault(); change(movePreviewRange(value, part, direction * (event.shiftKey ? 1 : 0.1), duration)); }
    else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); change(movePreviewRange(value, part, event.key === "Home" ? -duration : duration, duration));
    }
  }
  const percent = (n: number) => `${duration ? n / duration * 100 : 0}%`;
  return <div className="beat-selector">
    <audio ref={audio} crossOrigin="use-credentials" preload="metadata" onLoadedMetadata={event => {
      const length = Math.floor(event.currentTarget.duration * 10) / 10;
      if (!Number.isFinite(length) || length < 0.1) { setError("Este áudio não tem uma duração válida."); return; }
      setDuration(length);
      const saved = initialRange;
      onChange(saved && saved.start >= 0 && saved.end <= length && saved.end > saved.start && saved.end - saved.start <= 30 + 1e-9 ? saved : { start: 0, end: Math.min(12, length) });
    }} onEnded={stop} onPause={() => setPlaying(false)} onError={() => { stop(); setError("Não foi possível carregar este áudio."); }}
      onTimeUpdate={event => { if (!event.currentTarget.paused && event.currentTarget.currentTime >= value.end) stop(); }} />
    <div className="beat-selection-summary"><span>Início <strong>{time(value.start)}</strong></span><span className="beat-duration">{(value.end - value.start).toFixed(1)}s / 30s</span><span>Fim <strong>{time(value.end)}</strong></span></div>
    <div className="beat-range-track" ref={track}>
      {duration > 0 && <>
        <button type="button" className="beat-range-window" style={{ left: percent(value.start), width: percent(value.end - value.start) }} aria-label="Mover trecho selecionado" title="Arraste para mover. Setas: 0,1s; Shift + setas: 1s." onPointerDown={event => begin(event, "window")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => key(event, "window")} />
        <button type="button" className="beat-range-handle" style={{ left: percent(value.start) }} role="slider" aria-label="Início do preview" aria-valuemin={Math.max(0, value.end - 30)} aria-valuemax={value.end - 0.1} aria-valuenow={value.start} aria-valuetext={time(value.start)} onPointerDown={event => begin(event, "start")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => key(event, "start")} />
        <button type="button" className="beat-range-handle" style={{ left: percent(value.end) }} role="slider" aria-label="Fim do preview" aria-valuemin={value.start + 0.1} aria-valuemax={Math.min(duration, value.start + 30)} aria-valuenow={value.end} aria-valuetext={time(value.end)} onPointerDown={event => begin(event, "end")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => key(event, "end")} />
      </>}
    </div>
    <div className="beat-track-scale"><span>0:00</span><span>{duration ? time(duration) : "Carregando áudio…"}</span></div>
    <p className="beat-range-hint">Ajuste as pontas para recortar até 30s. Arraste o trecho destacado para escolher outra parte da música.</p>
    <button type="button" className="preview-listen" disabled={!duration || !!error} aria-pressed={playing} onClick={toggle}>{playing ? <Square size={16}/> : <Play size={16}/>} {playing ? "Parar de ouvir" : "Ouvir seleção"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
