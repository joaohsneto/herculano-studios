import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
export const metadata: Metadata = { title: "Criar conta — Herculano Studios", description: "Crie sua conta com email ou Google e acompanhe seus pedidos e downloads." };
export default function RegisterPage() { return <AuthScreen register />; }
