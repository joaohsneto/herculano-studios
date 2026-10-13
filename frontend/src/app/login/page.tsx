import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
export const metadata: Metadata = { title: "Entrar — Herculano Studios" };
const messages: Record<string, string> = {
  google_unavailable: "O acesso com Google está temporariamente indisponível. Você pode usar seu email e senha.",
  google_cancelled: "Você cancelou o acesso com Google. Pode tentar novamente quando quiser.",
  account_exists: "Este email já foi cadastrado com senha. Entre usando sua senha para acessar a conta existente.",
  CredentialsSignin: "Email ou senha incorretos.",
  AccessDenied: "O acesso com Google foi cancelado ou não autorizado. Tente novamente.",
  OAuthAccountNotLinked: "Este email já tem uma conta. Entre com sua senha.",
  Configuration: "O acesso está temporariamente indisponível. Tente novamente.",
  google_failed: "Não foi possível concluir o acesso com Google. Tente novamente."
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ authError?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const authError = params.authError || params.error;
  const message = typeof authError === "string" ? (messages[authError] || messages.google_failed) : "";
  return <AuthScreen key={message} initialMessage={message} />;
}
