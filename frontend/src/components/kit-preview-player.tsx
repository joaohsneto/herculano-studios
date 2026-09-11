"use client";
import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
export function KitPreviewPlayer({name,url}:{name:string;url:string}){
 const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false);const [error,setError]=useState("");
 async function toggle(){
  if(!audio.current)return;
  if(playing){audio.current.pause();setPlaying(false);return;}
  setError("");
  try{await audio.current.play();setPlaying(true);}catch{setPlaying(false);setError("Não foi possível tocar esta amostra.");}
 }
 return <div className="kit-preview-item"><button type="button" className="kit-preview-track" onClick={toggle} aria-label={`${playing?"Pausar":"Tocar"} ${name}`}><audio ref={audio} src={API+url} preload="metadata" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError("Arquivo de preview indisponível.");}}/><span><strong>{name}</strong><i className="fake-wave">{Array.from({length:34},(_,i)=><b key={i} style={{height:(8+((i*17)%22))+"px"}}/>)}</i></span><em>{playing?<Pause/>:<Play/>}</em></button>{error?<small className="preview-playback-error">{error}</small>:null}</div>
}
