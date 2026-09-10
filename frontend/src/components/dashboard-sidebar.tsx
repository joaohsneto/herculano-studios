"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, House, LogOut, PackageOpen, Settings, ShoppingCart, UserRound, UsersRound } from "lucide-react";

export function DashboardSidebar({ admin, userName }: { admin: boolean; userName?: string }) {
  const pathname = usePathname();
  const links = admin ? [
    { href: "/account", label: "Visão geral", icon: House },
    { href: "/admin/products", label: "Produtos", icon: Boxes },
    { href: "/admin/orders", label: "Vendas", icon: BarChart3 },
    { href: "/admin/customers", label: "Clientes", icon: UsersRound }
  ] : [
    { href: "/account", label: "Visão geral", icon: House },
    { href: "/account/library", label: "Minha biblioteca", icon: PackageOpen },
    { href: "/account/orders", label: "Meus pedidos", icon: ShoppingCart },
    { href: "/account/profile", label: "Meus dados", icon: UserRound }
  ];
  async function logout() {
    await fetch((process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000") + "/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }
  return <aside className="dashboard-sidebar">
    <Link href="/" className="brand dashboard-brand">H<span>•</span>S</Link>
    <div className="workspace-label"><span>{admin ? "Admin workspace" : "My studio"}</span><strong>{userName || "Herculano Studios"}</strong></div>
    <nav>{links.map(({href,label,icon:Icon})=><Link key={href} href={href} className={pathname===href?"active":""}><Icon size={17}/><span>{label}</span></Link>)}</nav>
    <div className="sidebar-bottom"><Link href="/account/settings"><Settings size={17}/>Configurações</Link><button onClick={logout}><LogOut size={17}/>Sair</button></div>
  </aside>;
}
