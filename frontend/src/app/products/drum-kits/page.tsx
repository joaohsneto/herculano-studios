import { ProductCard,type StoreProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
const API=process.env.API_URL??"http://localhost:4000";
async function load(){try{const r=await fetch(API+"/api/products?type=DRUM_KIT",{cache:"no-store"});return r.ok?(await r.json()).products:[]}catch{return []}}
export default async function DrumKitsPage(){const products:StoreProduct[]=await load();return <><SiteHeader/><main className="collection-page"><span className="section-index">Coleções / Drum kits</span><h1>Drum Kits</h1><p>Coleções de sons selecionados para produtores que buscam identidade e impacto.</p><div className="collection-grid">{products.map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div></main></>}

