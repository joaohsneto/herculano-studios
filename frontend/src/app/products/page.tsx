import { ProductCard,type StoreProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
const API=process.env.API_URL??"http://localhost:4000";
async function load(){try{const r=await fetch(API+"/api/products",{cache:"no-store"});return r.ok?(await r.json()).products:[]}catch{return []}}
export default async function ProductsPage(){const products:StoreProduct[]=await load();return <><SiteHeader/><main className="collection-page"><span className="section-index">Coleções / Todos os produtos</span><h1>Produtos</h1><p>Beats, drum kits e ferramentas para sua próxima produção.</p><div className="collection-grid">{products.map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div></main></>}

