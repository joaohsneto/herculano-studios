"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
export function KitPreviewPlayer({name,url,hideName=false}:{name:string;url:string;hideName?:boolean}){
 const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{const stopOthers=(event:Event)=>{if(event.target!==audio.current)audio.current?.pause();};document.addEventListener("play",stopOthers,true);return()=>document.removeEventListener("play",stopOthers,true);},[]);
 async function toggle(){
  if(!audio.current)return;
  if(playing){audio.current.pause();setPlaying(false);return;}
  setError("");
  try{await audio.current.play();setPlaying(true);}catch{setPlaying(false);setError("Não foi possível tocar esta amostra.");}
 }
 return <div className="kit-preview-item"><button type="button" className="kit-preview-track" onClick={toggle} aria-label={`${playing?"Pausar":"Tocar"} ${hideName?"prévia do beat":name}`}><audio ref={audio} src={url} preload="metadata" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError("Arquivo de prévia indisponível.");}}/><span>{!hideName&&<strong>{name}</strong>}<i className="fake-wave" style={hideName?{marginTop:0}:undefined}>{Array.from({length:34},(_,i)=><b key={i} style={{height:(8+((i*17)%22))+"px"}}/>)}</i></span><em>{playing?<Pause/>:<Play/>}</em></button>{error?<small className="preview-playback-error">{error}</small>:null}</div>
}
