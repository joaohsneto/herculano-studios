import Link from "next/link";

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  type: "BEAT" | "DRUM_KIT" | "SAMPLE_PACK" | "PRESET";
  shortDescription: string;
  description?: string;
  status?: string;
  previewGroups?: Array<{id:string;name:string;position:number;items:Array<{id:string;name:string;publicUrl:string;durationSec?:number}>}>;
  assets?: Array<{publicUrl?:string;fileName:string}>;
  variants: Array<{ id: string; name: string; priceCents: number; currency: string }>;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function ProductCard({ product, index }: { product: StoreProduct; index: number }) {
  const lowest = product.variants.reduce((value, item) => Math.min(value, item.priceCents), Number.POSITIVE_INFINITY);
  const price = Number.isFinite(lowest) ? "A partir de " + money(lowest, product.variants[0]?.currency ?? "BRL") : "Em breve";
  return (
    <article className="product-card">
      <Link href={"/products/" + product.slug} className={"cover cover-" + (index % 4)} aria-label={"Ver " + product.name}>
        <span className="cover-kicker">{product.type === "BEAT" ? "Beat series" : "Essential sounds"}</span>
        <strong>{product.name}</strong>
        <span className="cover-mark">HS</span>
        {product.type === "BEAT" && <span className="play">▶</span>}
      </Link>
      <div className="product-copy">
        <div>
          <span className="product-type">{product.type.replace("_", " ")}</span>
          <h3><Link href={"/products/" + product.slug}>{product.name}</Link></h3>
        </div>
        <p>{product.shortDescription}</p>
        <div className="product-meta">
          <span>{price}</span>
          <Link href={"/products/" + product.slug} className="round-link" aria-label="Abrir produto">↗</Link>
        </div>
      </div>
    </article>
  );
}
