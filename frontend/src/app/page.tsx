import Link from "next/link";
import { ProductCard, type StoreProduct } from "@/components/product-card";
import { ThemeLab } from "@/components/theme-lab";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import { AccountLink } from "@/components/account-link";
import { SiteHeader } from "@/components/site-header";

const fallbackProducts: StoreProduct[] = [
  { id: "beat-demo", name: "Afrobeat Type Teto x WIU", slug: "afrobeat-type-teto-x-wiu", type: "BEAT", shortDescription: "Afrobeat melódico com atmosfera moderna.", variants: [{ id: "mp3", name: "MP3", priceCents: 4990, currency: "BRL" }, { id: "wav", name: "WAV", priceCents: 8990, currency: "BRL" }] },
  { id: "kit-demo", name: "Brazilian Funk Essentials Series", slug: "brazilian-funk-essentials-series", type: "DRUM_KIT", shortDescription: "Sons essenciais para produzir funk brasileiro.", variants: [{ id: "zip", name: "Complete Kit", priceCents: 12990, currency: "BRL" }] }
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
          <div className="eyebrow"><span /> Sounds built beyond the grid</div>
          <h1>Shape your<br /><em>next sound.</em></h1>
          <p>Beats, drum kits and sonic tools crafted for producers who refuse to sound ordinary.</p>
          <div className="hero-actions"><Link href="#catalog" className="primary-button">Explore products <span>↗</span></Link><Link href="/beats" className="text-link">Listen to beats <span>→</span></Link></div>
          <div className="hero-orbit" aria-hidden="true"><div className="disc"><span>HS</span></div></div>
          <div className="scroll-cue">Scroll to discover <span>↓</span></div>
        </section>
        <section id="catalog" className="catalog">
          <div className="section-heading"><div><span className="section-index">01 / Catalog</span><h2>Made to move<br />the room.</h2></div><p>Every sound is designed, mixed and ready to become part of your next record.</p></div>
          <div className="filter-row"><div><button className="active">All</button><button>Beats</button><button>Drum kits</button><button>Presets</button></div><span>{String(items.length).padStart(2, "0")} products</span></div>
          <div className="product-grid">
            {items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
            <article className="coming-card"><span>Next drop</span><strong>New sounds<br />loading.</strong><i>Join the list →</i></article>
          </div>
        </section>
      </main>
      <ThemeLab />
    </>
  );
}
