import { ProductCard, type StoreProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";

const API = process.env.API_URL ?? "http://localhost:4000";

async function load(): Promise<StoreProduct[] | null> {
  try {
    const response = await fetch(API + "/api/products?type=BEAT", { cache: "no-store" });
    return response.ok ? (await response.json()).products : null;
  } catch {
    return null;
  }
}

export default async function BeatsPage() {
  const products = await load();
  return <>
    <SiteHeader/>
    <main className="collection-page">
      <span className="section-index">Coleções / Beats</span>
      <h1>Beats</h1>
      <p>Encontre o beat para sua próxima música. Ouça as prévias e escolha sua licença.</p>
      {products === null ? <p role="alert">Não foi possível carregar os beats. Tente atualizar a página.</p>
        : products.length === 0 ? <p>Nenhum beat disponível no momento.</p>
        : <div className="collection-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div>}
    </main>
  </>;
}
