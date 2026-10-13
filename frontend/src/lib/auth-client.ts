const authErrors: Record<string, string> = {
  CredentialsSignin: "Email ou senha incorretos.",
  AccessDenied: "Não foi possível autorizar o acesso com esta conta.",
  MissingCSRF: "A sessão do formulário expirou. Tente novamente.",
  OAuthAccountNotLinked: "Este email já tem uma conta. Entre com sua senha.",
  Configuration: "O acesso está temporariamente indisponível. Tente novamente."
};

export async function authAction(action: string, fields: Record<string, string> = {}) {
  const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const csrf = await csrfResponse.json();
  if (!csrfResponse.ok || typeof csrf.csrfToken !== "string") throw new Error("Não foi possível iniciar a autenticação. Tente novamente.");
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ ...fields, csrfToken: csrf.csrfToken }), signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Não foi possível continuar. Tente novamente.");
  if (typeof data?.url !== "string") throw new Error("Não foi possível confirmar a autenticação.");
  const url = new URL(data.url, window.location.origin);
  const error = url.searchParams.get("error");
  if (error) throw new Error(authErrors[error] || "Não foi possível entrar. Tente novamente.");
  return url;
}

export async function signInWithPassword(email: string, password: string) {
  await authAction("callback/credentials", { email, password, callbackUrl: "/account" });
  const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok || !data.user) throw new Error("Não foi possível confirmar sua sessão. Tente entrar novamente.");
  window.location.assign(data.user.role === "ADMIN" ? "/admin/products" : "/account");
}
