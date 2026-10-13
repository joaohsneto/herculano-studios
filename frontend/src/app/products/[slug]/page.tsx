import Link from "next/link";
import { BeatPreviewCover } from "@/components/beat-preview-cover";
import { money } from "@/lib/cart";
import { productTypeLabel } from "@/lib/product-types";
import { ProductPurchase } from "@/components/product-purchase";
import { notFound } from "next/navigation";
import { KitPreviewPlayer } from "@/components/kit-preview-player";
import { ProductCard, type StoreProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
const API=process.env.API_URL??"http://localhost:4000";
async function load(slug:string){try{const r=await fetch(API+"/api/products/"+slug,{cache:"no-store"});return r.ok?(await r.json()).product:null}catch{return null}}
async function relatedProducts(product: StoreProduct): Promise<StoreProduct[]> {
  try {
    const response = await fetch(API + "/api/products", { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.products as StoreProduct[])
      .filter(item => item.id !== product.id)
      .sort((a, b) => Number(b.type === product.type) - Number(a.type === product.type))
      .slice(0, 4);
  } catch { return []; }
}

export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product: StoreProduct = await load(slug);
  if (!product) notFound();
  const isBeat = product.type === "BEAT";
  const preview = product.previewGroups?.flatMap(group => group.items)[0];
  const related = await relatedProducts(product);
  return <><SiteHeader/><main className="product-detail-page">
    <section className="product-hero">
      {isBeat ? <BeatPreviewCover key={product.id} name={product.name} url={preview?.publicUrl} durationSec={preview?.durationSec}/> : <div className="detail-cover"><span>HERCULANO STUDIOS</span><strong>{product.name}</strong><i>{productTypeLabel(product.type)}</i></div>}
      <div className="detail-copy"><span className="section-index">{productTypeLabel(product.type)}</span><h1>{product.name}</h1><p>{product.shortDescription}</p><div className="detail-rule"/><ProductPurchase product={product}/></div>
    </section>
    <section className="about-pack"><span className="section-index">{isBeat ? "Sobre o beat" : "Sobre o produto"}</span><h2>Conheça o conteúdo.</h2><p>{product.description}</p></section>
    {!isBeat && product.previewGroups?.length ? <section className="kit-previews"><span className="section-index">Prévias de áudio</span><h2>Ouça os sons do produto.</h2><p>O produto completo é liberado após a compra.</p>{product.previewGroups.map(group => <div className="preview-group" key={group.id}><h3>{group.name}</h3><div>{group.items.slice(0, 2).map(item => <KitPreviewPlayer key={item.id} name={item.name} url={item.publicUrl}/>)}</div></div>)}</section> : null}
    {related.length > 0 && <section className="related-beats" aria-labelledby="related-beats-title"><span className="section-index">Continue explorando</span><div className="related-beats-heading"><h2 id="related-beats-title">Você também pode gostar</h2><Link href="/products">Ver todos os produtos →</Link></div><p>Explore outros sons e ferramentas para sua próxima produção.</p><div className="related-beats-grid">{related.map((item, index) => {
      if (item.type !== "BEAT") return <ProductCard key={item.id} product={item} index={index}/>;
      const sample = item.previewGroups?.flatMap(group => group.items)[0];
      const cheapest = item.variants.reduce<StoreProduct["variants"][number] | undefined>((best, variant) => !best || variant.priceCents < best.priceCents ? variant : best, undefined);
      return <article key={item.id}><BeatPreviewCover compact name={item.name} url={sample?.publicUrl} durationSec={sample?.durationSec}/><h3><Link href={"/products/" + item.slug}>{item.name}</Link></h3><div className="related-beat-price"><span>{cheapest ? "A partir de " + money(cheapest.priceCents, cheapest.currency) : "Em breve"}</span><Link href={"/products/" + item.slug} aria-label={"Ver detalhes de " + item.name}>Ver beat ↗</Link></div></article>;
    })}</div></section>}
  </main></>;
}
