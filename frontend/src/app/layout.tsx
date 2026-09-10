import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./auth.css";
import "./dashboard.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Herculano Studios — Sounds beyond the grid",
  description: "Beats, drum kits, sample packs and presets crafted for modern music producers."
};

const themeScript = 'try{var p=localStorage.getItem("hs-palette")||"indigo";var m=localStorage.getItem("hs-mode")||"dark";document.documentElement.dataset.palette=p;document.documentElement.dataset.mode=m}catch(e){}';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-palette="indigo" data-mode="dark" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
