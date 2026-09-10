"use client";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import { AccountLink } from "@/components/account-link";
export function SiteHeader(){const pathname=usePathname();return <header className="site-header shared-header"><Link href="/" className="brand" aria-label="Herculano Studios">H<span>•</span>S</Link><nav aria-label="Navegação principal"><Link className={pathname==="/"?"active":""} href="/">Home</Link><div className="nav-menu"><Link className={pathname.startsWith("/products")?"active":""} href="/products">Products</Link><div><Link href="/products/drum-kits">Drum Kits</Link><Link href="/beats">Beats</Link></div></div><Link className={pathname.startsWith("/beats")?"active":""} href="/beats">Beats</Link><Link className={pathname.startsWith("/contact")?"active":""} href="/contact">Contact</Link></nav><div className="header-actions"><button className="icon-action" aria-label="Pesquisar"><Search strokeWidth={1.8}/></button><AccountLink compact/><Link className="icon-action bag-action" href="/cart" aria-label="Carrinho"><ShoppingBag strokeWidth={1.8}/><sup>0</sup></Link></div></header>}

