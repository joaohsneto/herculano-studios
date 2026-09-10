"use client";
import { useState } from "react";
import { FileArchive, UploadCloud } from "lucide-react";
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
export function DrumKitPreviewUploader({productId}:{productId:string}){const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);async function upload(file?:File){if(!file)return;setBusy(true);setMessage("Extraindo dois sons por pasta...");const body=new FormData();body.append("file",file);const r=await fetch(API+"/api/media/admin/products/"+productId+"/drum-kit-previews",{method:"POST",credentials:"include",body});const data=await r.json();setMessage(r.ok?data.message:data.message??"Falha no processamento.");setBusy(false);}return <div className="kit-inspector-note"><FileArchive/><div><strong>Previews do Drum Kit</strong><span>Envie o ZIP para gerar automaticamente duas amostras por pasta.</span><label className="inspector-upload"><UploadCloud/>{busy?"Processando...":"Selecionar ZIP"}<input type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/></label><small>{message}</small></div></div>}

