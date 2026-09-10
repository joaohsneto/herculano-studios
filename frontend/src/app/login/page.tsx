"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { ThemeLab } from "@/components/theme-lab";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Entrando...");
    const form = new FormData(event.currentTarget);
    const response = await fetch(API + "/api/auth/login", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "Não foi possível entrar.");
    window.location.href = data.user.role === "ADMIN" ? "/admin/products" : "/";
  }
  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <Link href="/" className="brand auth-brand" aria-label="Herculano Studios">H<span>•</span>S</Link>
        <Link href="/" className="back-link"><ArrowLeft size={15} /> Voltar para a loja</Link>
        <div className="auth-art" aria-hidden="true"><div className="auth-record"><b>HS</b></div><i className="orbit-one" /><i className="orbit-two" /></div>
        <div className="auth-quote"><span>Herculano Studios</span><strong>Seu próximo som<br />começa aqui.</strong><p>Beats e ferramentas sonoras criadas para transformar ideias em músicas.</p></div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <span className="section-index">Área do cliente</span>
          <h1>Bem-vindo<br /><em>de volta.</em></h1>
          <p className="auth-intro">Entre para acessar seus pedidos, downloads e produtos.</p>
          <label><span>E-mail</span><div className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="voce@email.com" required /></div></label>
          <label><span>Senha <Link href="/forgot-password">Esqueceu a senha?</Link></span><div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          <button className="primary-button auth-submit" type="submit">Entrar <ArrowRight size={16} /></button>
          <p className="form-message" aria-live="polite">{message}</p>
          <div className="auth-divider"><span>ou</span></div>
          <button className="google-button" type="button"><b>G</b> Continuar com Google <span>Em breve</span></button>
          <p className="register-callout">Ainda não tem uma conta? <Link href="/register">Criar conta</Link></p>
        </form>
      </section>
      <ThemeLab />
    </main>
  );
}
