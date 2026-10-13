"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, UserRound } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ThemeLab } from "@/components/theme-lab";

type Profile = { name: string; email: string; phone: string | null; company: string | null; role: "ADMIN" | "CUSTOMER"; hasPassword: boolean; canChangeEmail: boolean };
type Feedback = { error: boolean; text: string };

async function request(path: string, method?: string, body?: unknown) {
  const response = await fetch(`/api/account/profile${path}`, {
    credentials: "include", cache: "no-store", method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
  });
  if (response.status === 401) { window.location.assign(new URL("/login", window.location.origin).href); throw new Error("Sua sessão expirou. Entre novamente."); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Não foi possível concluir a solicitação.");
  return result;
}

export default function ProfilePage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(null);
  const [emailStage, setEmailStage] = useState<"request" | "confirm">("request");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<Feedback | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  useEffect(() => {
    let active = true;
    request("").then(({ user }: { user: Profile }) => {
      if (!active) return;
      setUser(user); setName(user.name); setPhone(user.phone || ""); setCompany(user.company || "");
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar seus dados."); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setProfileFeedback(null);
    try {
      const { user: updated } = await request("", "PATCH", { name, phone, company });
      setUser(updated); setName(updated.name); setPhone(updated.phone || ""); setCompany(updated.company || "");
      setProfileFeedback({ error: false, text: "Seus dados foram salvos com sucesso." });
    } catch (error) { setProfileFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível salvar seus dados." }); }
    finally { setSaving(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setPasswordFeedback(null);
    if (data.get("newPassword") !== data.get("confirmPassword")) { setPasswordFeedback({ error: true, text: "A confirmação precisa ser igual à nova senha." }); return; }
    setChangingPassword(true);
    try {
      const result = await request("/password", "POST", { currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") });
      form.reset(); setPasswordFeedback({ error: false, text: result.message });
    } catch (error) { setPasswordFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível alterar sua senha." }); }
    finally { setChangingPassword(false); }
  }
  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setEmailBusy(true); setEmailFeedback(null);
    try {
      if (emailStage === "request") {
        const email = String(data.get("email"));
        const result = await request("/email", "POST", { email, currentPassword: data.get("currentPassword") });
        setPendingEmail(email); form.reset(); setEmailStage("confirm");
        setEmailFeedback({ error: false, text: result.message });
      } else {
        const result = await request("/email/confirm", "POST", { code: data.get("code") });
        setUser(current => current ? { ...current, email: result.email } : current);
        form.reset(); setEmailStage("request"); setPendingEmail("");
        setEmailFeedback({ error: false, text: result.message });
      }
    } catch (error) { setEmailFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível alterar seu e-mail." }); }
    finally { setEmailBusy(false); }
  }
  if (!user) return <main className="dashboard-loading"><div role={loadError ? "alert" : "status"}>{loadError || "Carregando seus dados..."}{loadError && <button className="dashboard-cta" onClick={() => window.location.reload()}>Tentar novamente</button>}</div></main>;
  const dirty = name.trim() !== user.name || phone.trim() !== (user.phone || "") || company.trim() !== (user.company || "");
  return <main className="dashboard-shell">
    <DashboardSidebar admin={user.role === "ADMIN"} userName={user.name}/>
    <section className="dashboard-content profile-content">
      <header className="dashboard-topbar"><div><span className="section-index">Minha conta</span><h1>Meus dados</h1><p>Mantenha seu cadastro atualizado e cuide da segurança da sua conta.</p></div></header>
      <form className="dashboard-panel profile-panel" onSubmit={saveProfile}>
        <header className="profile-heading"><UserRound size={22}/><div><h2>Dados pessoais</h2><p>Estas informações fazem parte do seu cadastro no estúdio.</p></div></header>
        <fieldset disabled={saving} className="profile-fields">
          <label>Nome completo<input name="name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={event => { setName(event.target.value); setProfileFeedback(null); }}/></label>
          <label>E-mail usado para entrar na conta<input type="email" autoComplete="email" value={user.email} readOnly aria-describedby="profile-email-help"/><small id="profile-email-help">Seu endereço só será atualizado depois da confirmação na seção abaixo.</small></label>
          <label>Telefone / WhatsApp <span>(opcional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="(82) 99999-9999" value={phone} onChange={event => { setPhone(event.target.value); setProfileFeedback(null); }}/><small>Informe o DDD. Para números internacionais, inclua o código do país.</small></label>
          <label>Empresa <span>(opcional)</span><input name="company" autoComplete="organization" maxLength={150} placeholder="Nome da sua empresa" value={company} onChange={event => { setCompany(event.target.value); setProfileFeedback(null); }}/></label>
        </fieldset>
        <footer className="profile-actions"><a href="/contact">Falar com o estúdio</a><button type="submit" className="dashboard-cta" disabled={saving || !dirty}>{saving ? "Salvando..." : "Salvar alterações"}</button></footer>
        {profileFeedback && <p className={`profile-feedback ${profileFeedback.error ? "is-error" : ""}`} role={profileFeedback.error ? "alert" : "status"}>{profileFeedback.text}</p>}
      </form>
      <section className="dashboard-panel profile-panel">
        <header className="profile-heading"><UserRound size={22}/><div><h2>Alterar e-mail</h2><p>Confirme sua senha e verifique o novo endereço antes de atualizar seu acesso.</p></div></header>
        {user.canChangeEmail ? <form onSubmit={changeEmail}>
          <fieldset disabled={emailBusy} className="profile-fields" key={emailStage}>
            {emailStage === "request" ? <>
              <label>Novo e-mail<input type="email" name="email" autoComplete="email" required maxLength={254}/></label>
              <label>Senha atual<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={72}/></label>
            </> : <label>Código enviado para {pendingEmail}<input name="code" autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6}" minLength={6} maxLength={6}/><small>O código expira em 10 minutos e pode ser usado uma única vez.</small></label>}
          </fieldset>
          <footer className="profile-actions">
            {emailStage === "confirm" && <button type="button" className="profile-secondary" disabled={emailBusy} onClick={() => { setEmailStage("request"); setEmailFeedback(null); }}>Solicitar outro código</button>}
            <button type="submit" className="dashboard-cta" disabled={emailBusy}>{emailBusy ? "Aguarde..." : emailStage === "request" ? "Enviar código de confirmação" : "Confirmar novo e-mail"}</button>
          </footer>
          {emailFeedback && <p className={`profile-feedback ${emailFeedback.error ? "is-error" : ""}`} role={emailFeedback.error ? "alert" : "status"}>{emailFeedback.text}</p>}
        </form> : <p className="profile-provider-note">O e-mail desta conta é gerenciado pelo Google. Continue usando o Google para entrar.</p>}
      </section>
      <section className="dashboard-panel profile-panel">
        <header className="profile-heading"><LockKeyhole size={22}/><div><h2>Segurança</h2><p>{user.hasPassword ? "Altere sua senha para proteger o acesso à sua conta." : "Você entra nesta conta usando o Google."}</p></div></header>
        {user.hasPassword ? <form onSubmit={changePassword}>
          <fieldset disabled={changingPassword} className="profile-fields">
            <label>Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={72}/></label>
            <label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,72}" aria-describedby="profile-password-help"/><small id="profile-password-help">Use de 8 a 72 caracteres, com maiúscula, minúscula, número e símbolo.</small></label>
            <label>Confirmar nova senha<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72}/></label>
          </fieldset>
          <footer className="profile-actions"><button type="submit" className="dashboard-cta" disabled={changingPassword}>{changingPassword ? "Alterando..." : "Alterar senha"}</button></footer>
          {passwordFeedback && <p className={`profile-feedback ${passwordFeedback.error ? "is-error" : ""}`} role={passwordFeedback.error ? "alert" : "status"}>{passwordFeedback.text}</p>}
        </form> : <p className="profile-provider-note">Sua senha é gerenciada na sua conta Google.</p>}
      </section>
    </section><ThemeLab/>
  </main>;
}
