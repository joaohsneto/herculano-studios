"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { signInWithPassword } from "@/lib/auth-client";
import { ThemeLab } from "@/components/theme-lab";


export function AuthScreen({ register = false, initialMessage = "" }: { register?: boolean; initialMessage?: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (register && password !== form.get("confirmPassword")) {
      setMessage("As senhas precisam ser iguais.");
      return;
    }
    if (register && (new TextEncoder().encode(password).length > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))) {
      setMessage("Use uma senha mais curta, com maiúscula, minúscula, número e símbolo.");
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const email = String(form.get("email") || "");
      if (register) {
        const response = await fetch("/api/auth/register", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), email, password }), signal: AbortSignal.timeout(20000)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) { setMessage(data?.message || "Não foi possível cadastrar. Tente novamente."); return; }
      }
      await signInWithPassword(email, password);
    } catch (error) {
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "A conexão falhou. Tente novamente; se acabou de se cadastrar, tente entrar com seus dados.");
    } finally { busy.current = false; setPending(false); }
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
        <form className="auth-card" onSubmit={submit} aria-busy={pending}>
          <span className="section-index">Área do cliente</span>
          <h1>{register ? "Seu som," : "Bem-vindo"}<br /><em>{register ? "seu espaço." : "de volta."}</em></h1>
          <p className="auth-intro">{register ? "Crie sua conta para reunir seus pedidos e downloads. Vamos começar?" : "Entre para acessar seus pedidos, downloads e produtos."}</p>
          <fieldset className="auth-fields" disabled={pending}>
          {register && <label><span>Como posso te chamar?</span><div className="input-wrap"><UserRound size={17} /><input name="name" autoComplete="name" placeholder="Seu nome" minLength={2} maxLength={100} required /></div></label>}
          <label><span>E-mail</span><div className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="voce@email.com" maxLength={254} required /></div></label>
          <label><span>Senha {!register && <Link href="/forgot-password">Esqueceu a senha?</Link>}</span><div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Crie uma senha segura" : "Sua senha"} minLength={register ? 8 : 1} maxLength={72} aria-describedby={register ? "password-help" : undefined} required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {register && <><p id="password-help" className="password-help">Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.</p><label><span>Confirmar senha</span><div className="input-wrap"><LockKeyhole size={17} /><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repita sua senha" minLength={8} maxLength={72} required /></div></label></>}
          <button className="primary-button auth-submit" type="submit">{pending ? (register ? "Criando sua conta..." : "Entrando...") : (register ? "Criar minha conta" : "Entrar")} <ArrowRight size={16} /></button>
          </fieldset>
          <p className="form-message" aria-live="polite">{message}</p>
          <div className="auth-divider"><span>ou</span></div>
          <GoogleSignIn />
          <p className="register-callout">{register ? "Já tem uma conta?" : "Ainda não tem uma conta?"} <Link href={register ? "/login" : "/register"}>{register ? "Entrar" : "Criar conta"}</Link></p>
        </form>
      </section>
      <ThemeLab />
    </main>
  );
}
