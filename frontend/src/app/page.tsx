import Link from "next/link";
import { ProductCard, type StoreProduct } from "@/components/product-card";
import { ThemeLab } from "@/components/theme-lab";
import { SiteHeader } from "@/components/site-header";

const fallbackProducts: StoreProduct[] = [
  { id: "beat-demo", name: "Afrobeat Type Teto x WIU", slug: "afrobeat-type-teto-x-wiu", type: "BEAT", shortDescription: "Afrobeat melódico com atmosfera moderna.", variants: [{ id: "mp3", name: "MP3", priceCents: 4990, currency: "BRL" }, { id: "wav", name: "WAV", priceCents: 8990, currency: "BRL" }] },
  { id: "kit-demo", name: "Brazilian Funk Essentials Series", slug: "brazilian-funk-essentials-series", type: "DRUM_KIT", shortDescription: "Sons essenciais para produzir funk brasileiro.", variants: [{ id: "zip", name: "Kit completo", priceCents: 12990, currency: "BRL" }] }
];

async function products(): Promise<StoreProduct[]> {
  try {
    const response = await fetch((process.env.API_URL ?? "http://localhost:4000") + "/api/products", { cache: "no-store" });
    if (!response.ok) return fallbackProducts;
    return (await response.json()).products;
  } catch { return fallbackProducts; }
}

export default async function Home() {
  const items = await products();
  return (
    <>
      <SiteHeader/>
      <main>
        <section className="hero">
          <div className="hero-noise" aria-hidden="true" />
          <div className="eyebrow"><span /> Sons para transformar ideias</div>
          <h1 lang="en">Make what<br /><em>moves people.</em></h1>
          <p>Beats, kits e ferramentas sonoras para dar vida às suas ideias.</p>
          <div className="hero-actions"><Link href="#catalog" className="primary-button">Explorar produtos <span>↗</span></Link><Link href="/products/beats" className="text-link">Ouvir beats <span>→</span></Link></div>
          <div className="hero-orbit" aria-hidden="true"><div className="disc"><span>HS</span></div></div>
          <div className="scroll-cue">Role para descobrir <span>↓</span></div>
        </section>
        <section id="catalog" className="catalog">
          <div className="section-heading"><div><span className="section-index">01 / Catálogo</span><h2>Sons que inspiram.<br />Ideias que ganham vida.</h2></div><p>Cada som é criado e mixado para fazer parte da sua próxima música.</p></div>
          <div className="filter-row"><div><button className="active">Todos</button><button>Beats</button><button>Drum kits</button><button>Presets</button></div><span>{String(items.length).padStart(2, "0")} produtos</span></div>
          <div className="product-grid">
            {items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
            <article className="coming-card"><span>Próximo lançamento</span><strong>Novos sons<br />a caminho.</strong><i>Entre na lista →</i></article>
          </div>
        </section>
      </main>
      <ThemeLab />
    </>
  );
}
