"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";

export function ContactForm({ orderId }: { orderId?: string }) {
  const initialMessage = orderId ? `Olá, preciso de ajuda com o pedido ${orderId}.\n\n` : "";
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const [length, setLength] = useState(initialMessage.length);
  const busy = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    setFeedback("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), signal: AbortSignal.timeout(45000)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Não foi possível enviar agora. Tente novamente ou fale comigo por email.");
      setStatus("success");
      form.reset();
      setLength(initialMessage.length);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error && error.name === "Error" ? error.message : "A conexão não confirmou o envio. Sua mensagem foi preservada. Confira sua internet e tente novamente, ou fale comigo por email.");
    } finally { busy.current = false; }
  }
  return <section className="contact-card" aria-label="Envie sua mensagem">
    {status === "success" ? <div className="contact-success" ref={resultRef} tabIndex={-1} role="status"><span className="contact-check"><Check size={30} /></span><span className="section-index">Conversa iniciada</span><h2>Seu oi já<br /><em>chegou por aqui.</em></h2><p>Obrigado por compartilhar sua ideia! Vou responder pelo email que você informou. Fique de olho na sua caixa de entrada e no spam.</p><button className="primary-button" onClick={() => setStatus("idle")}>Enviar outra mensagem <ArrowRight size={16} /></button></div> : <>
      <div className="contact-card-heading"><span className="section-index">Seu próximo som começa aqui</span><h2>{orderId ? "Ajuda com seu pedido" : "O que vamos criar?"}</h2><p>{orderId ? "O número do pedido já está na mensagem. Conte o que aconteceu para eu ajudar." : "Preencha abaixo. Vou adorar saber mais."}</p></div>
      <form onSubmit={submit} aria-busy={status === "sending"}>
        <fieldset disabled={status === "sending"}>
          <div className="contact-fields"><label htmlFor="contact-name">Como posso te chamar?<input id="contact-name" name="name" autoComplete="name" placeholder="Seu nome" minLength={2} maxLength={100} required /></label><label htmlFor="contact-email">Seu email<input id="contact-email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" maxLength={254} required /></label></div>
          <label htmlFor="contact-topic">Sobre o que você quer conversar?<select id="contact-topic" name="topic" defaultValue={orderId ? "Ajuda com um pedido" : ""} required><option value="" disabled>Escolha um assunto</option>{["Projeto personalizado", "Beats e licenças", "Drum kits e produtos", "Ajuda com um pedido", "Parcerias", "Outro assunto"].map(topic => <option key={topic}>{topic}</option>)}</select></label>
          <label htmlFor="contact-message">Me conta um pouco mais<textarea id="contact-message" name="message" defaultValue={initialMessage} rows={6} minLength={10} maxLength={5000} placeholder="O que você está imaginando? Se for sobre um pedido, pode incluir o número dele aqui." required aria-describedby="contact-message-help" onChange={event => setLength(event.target.value.length)} /></label>
          <div className="contact-message-help" id="contact-message-help"><span>Do seu jeito. De 10 a 5.000 caracteres.</span><span>{length.toLocaleString("pt-BR")} / 5.000</span></div>
          <div className="contact-honey" aria-hidden="true"><label>Site<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
          <p className="contact-privacy">Seu nome e email serão usados para responder a esta conversa. Não envie senhas ou dados de pagamento.</p>
          <button className="primary-button contact-submit" type="submit">{status === "sending" ? <>Enviando sua mensagem <LoaderCircle size={18} className="contact-spinner" /></> : <>Vamos conversar <ArrowRight size={18} /></>}</button>
        </fieldset>
        <div aria-live="polite" aria-atomic="true">{status === "error" && <p className="contact-error" role="alert">{feedback} <a href="mailto:herculanostudios@gmail.com">herculanostudios@gmail.com</a></p>}</div>
        <p className="contact-form-footnote">Todos os campos são obrigatórios. Sem compromisso, só uma boa conversa.</p>
      </form>
    </>}
  </section>;
}
