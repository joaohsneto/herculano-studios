"use client";
import { useRef, useState } from "react";
import { authAction } from "@/lib/auth-client";

export function GoogleSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function signIn() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/providers", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const providers = await response.json();
      if (!response.ok || !providers.google) throw new Error("O acesso com Google está temporariamente indisponível. Use seu email e senha.");
      const url = await authAction("signin/google", { callbackUrl: "/account" });
      if (url.origin !== window.location.origin && url.origin !== "https://accounts.google.com") throw new Error("Não foi possível iniciar o acesso com Google.");
      window.location.assign(url.href);
    } catch (error) {
      setError(error instanceof Error && error.name === "Error" ? error.message : "A conexão falhou. Tente novamente.");
      busy.current = false;
      setPending(false);
    }
  }
  return <><button className="google-button" type="button" onClick={signIn} disabled={pending}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg><span className="google-label">{pending ? "Conectando ao Google..." : "Continuar com Google"}</span></button><p className="form-message" aria-live="polite">{error}</p></>;
}
