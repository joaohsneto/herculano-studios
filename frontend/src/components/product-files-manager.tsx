"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { fileSize } from "@/lib/library";
import type { StoreProduct } from "./product-card";

type Asset = { id: string; kind: string; fileName: string; sizeBytes: number; variantId: string | null };
export function ProductFilesManager({ product }: { product: StoreProduct }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(`/api/media/admin/products/${product.id}/assets`, { credentials: "include", cache: "no-store" }).then(async response => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar os arquivos.");
    setAssets(result.assets);
  }).catch(error => setMessage(error instanceof Error ? error.message : "Não foi possível carregar os arquivos.")), [product.id]);
  useEffect(() => { void load(); }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setMessage("");
    try {
      const data = new FormData(form);
      if (!data.get("variantId")) data.delete("variantId");
      const response = await fetch(`/api/media/admin/products/${product.id}/assets`, { method: "POST", credentials: "include", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível enviar o arquivo.");
      form.reset(); await load(); setMessage("Arquivo adicionado com sucesso.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o arquivo."); }
    finally { setBusy(false); }
  }
  return <section className="product-delivery"><h3>Conteúdo da biblioteca</h3><p>Arquivos de cada versão ficam disponíveis somente para quem comprou essa versão.</p>
    <div className="delivery-assets">{assets.map(asset => <div key={asset.id}><FileText size={17}/><span><strong>{asset.fileName}</strong><small>{fileSize(asset.sizeBytes)} · {asset.kind === "COVER" ? "Capa" : asset.variantId ? product.variants.find(variant => variant.id === asset.variantId)?.name || "Versão específica" : "Todas as versões"}</small></span></div>)}</div>
    <form onSubmit={upload}><fieldset disabled={busy}><input type="hidden" name="kind" value="DOWNLOAD"/><label>Disponível para<select name="variantId" defaultValue={product.variants[0]?.id}>{product.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}<option value="">Todas as versões (material comum)</option></select></label><label>Adicionar arquivo<input type="file" name="file" required/></label><button type="submit" className="dashboard-cta"><UploadCloud size={17}/>{busy ? "Enviando..." : "Enviar material"}</button></fieldset></form>
    <form onSubmit={upload}><fieldset disabled={busy}><input type="hidden" name="kind" value="COVER"/><label>Capa do produto (até 10 MB)<input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required/></label><button type="submit" className="profile-secondary">Adicionar capa</button></fieldset></form>
    {message && <p role="status">{message}</p>}
  </section>;
}
