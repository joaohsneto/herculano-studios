import { CartProvider } from "@/components/cart-provider";
import "./cart.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./auth.css";
import "./dashboard.css";
import "./beat-preview.css";
import "./library.css";
import "./customers.css";
import "./purchases.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Herculano Studios — Seu próximo som começa aqui",
  description: "Beats, drum kits, sample packs e presets para dar vida às suas ideias e criar músicas que tocam as pessoas."
};

const themeScript = 'try{var p="coral";localStorage.setItem("hs-palette",p);var m=localStorage.getItem("hs-mode")||"dark";document.documentElement.dataset.palette=p;document.documentElement.dataset.mode=m}catch(e){}';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-palette="coral" data-mode="dark" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
