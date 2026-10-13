import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, AudioLines, Mail } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ThemeLab } from "@/components/theme-lab";
import { ContactForm } from "@/components/contact-form";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contato — Herculano Studios",
  description: "Tem uma ideia, uma dúvida ou um projeto em mente? Vamos conversar sobre seu próximo som."
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  const params = await searchParams;
  const order = typeof params.order === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(params.order) ? params.order : undefined;
  return <div className="contact-page">
    <SiteHeader />
    <main className="contact-main">
      <Link href="/" className="contact-back"><ArrowLeft size={14} /> Voltar para a loja</Link>
      <div className="contact-grid">
        <section className="contact-intro" aria-labelledby="contact-title">
          <div className="eyebrow"><span /> Vamos conversar</div>
          <h1 id="contact-title">Toda boa ideia<br />começa com<br /><em>um oi.</em></h1>
          <p>Um som na cabeça, um projeto no papel ou só uma dúvida? Pode chegar. Quero ouvir o que você tem em mente.</p>
          <div className="contact-note"><AudioLines size={24} aria-hidden="true" /><div><strong>Do outro lado, sou eu.</strong><p>Sem precisar de um briefing perfeito. Me conte do seu jeito e a gente encontra o próximo passo.</p></div></div>
          <a className="contact-email" href="mailto:herculanostudios@gmail.com"><Mail size={19} aria-hidden="true" /><span><small>Prefere escrever direto?</small><strong>herculanostudios@gmail.com</strong></span><ArrowUpRight size={18} aria-hidden="true" /></a>
          <div className="contact-signature"><span className="brand" aria-hidden="true">H<span>•</span>S</span><span>Ideias diferentes.<br />Novas possibilidades sonoras.</span></div>
        </section>
        <ContactForm orderId={order} key={order || "general"} />
      </div>
      <section className="contact-next" aria-label="Como funciona o contato"><span className="section-index">Uma conversa, sem complicação</span><div><p><b>01</b><strong>Me conte sua ideia</strong><span>Vale projeto, dúvida, parceria ou aquele som que ainda está tomando forma.</span></p><p><b>02</b><strong>Eu leio com atenção</strong><span>Sua mensagem chega direto ao meu email, para uma conversa de verdade.</span></p><p><b>03</b><strong>A gente continua por email</strong><span>Vou usar o endereço que você informar para responder e combinar os próximos passos.</span></p></div></section>
    </main>
    <footer className="contact-footer"><Link href="/">Herculano Studios</Link><span>Feito para conectar ideias e música.</span></footer>
    <ThemeLab />
  </div>;
}
