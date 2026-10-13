"use client";
import { useCart } from "./cart-provider";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import { AccountLink } from "@/components/account-link";
export function SiteHeader(){const pathname=usePathname();const {items}=useCart();return <header className="site-header shared-header"><Link href="/" className="brand" aria-label="Herculano Studios">H<span>•</span>S</Link><nav aria-label="Navegação principal"><Link className={pathname==="/"?"active":""} href="/">Início</Link><div className="nav-menu"><Link className={pathname.startsWith("/products")?"active":""} href="/products">Produtos</Link><div><Link href="/products/drum-kits">Drum Kits</Link><Link href="/products/beats">Beats</Link></div></div><Link className={pathname.startsWith("/contact")?"active":""} href="/contact">Contato</Link></nav><div className="header-actions"><button className="icon-action" aria-label="Pesquisar"><Search strokeWidth={1.8}/></button><AccountLink compact/><Link className="icon-action bag-action" href="/cart" aria-label={`Carrinho, ${items.length} itens`}><ShoppingBag strokeWidth={1.8}/><sup>{items.length}</sup></Link></div></header>}

