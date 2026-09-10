"use client";
import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
export function KitPreviewPlayer({name,url}:{name:string;url:string}){
 const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false);
 function toggle(){if(!audio.current)return;if(playing)audio.current.pause();else void audio.current.play();setPlaying(!playing);}
 return <button className="kit-preview-track" onClick={toggle}><audio ref={audio} src={API+url} preload="none" onEnded={()=>setPlaying(false)}/><span><strong>{name}</strong><i className="fake-wave">{Array.from({length:34},(_,i)=><b key={i} style={{height:(8+((i*17)%22))+"px"}}/>)}</i></span><em>{playing?<Pause/>:<Play/>}</em></button>
}

