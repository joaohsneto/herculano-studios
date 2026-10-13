import { createHmac, randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { transport, CONTACT_EMAIL } from "./contact.js";

export const emailChangeConfigured = () => Boolean(transport);
export const newEmailCode = () => String(randomInt(100000, 1000000));
export const emailCodeHash = (userId: string, email: string, code: string) =>
  createHmac("sha256", env.AUTH_SECRET || env.JWT_SECRET).update(JSON.stringify([userId, email, code])).digest("hex");

export function emailChangeMessage(email: string, code: string) {
  return {
    to: email,
    from: { name: "Herculano Studios", address: env.SMTP_FROM || env.SMTP_USER || CONTACT_EMAIL },
    subject: "Confirme seu novo e-mail — Herculano Studios",
    text: `Seu código de confirmação é ${code}. Ele expira em 10 minutos. Digite o código em Meus dados para confirmar seu novo e-mail. Se você não solicitou esta alteração, ignore esta mensagem.`
  };
}
export async function sendEmailChange(email: string, code: string) {
  if (!transport) throw new Error("SMTP_NOT_CONFIGURED");
  const result = await transport.sendMail(emailChangeMessage(email, code));
  if (!result.accepted.some(address => String(address).toLowerCase() === email)) throw new Error("SMTP_RECIPIENT_REJECTED");
}
