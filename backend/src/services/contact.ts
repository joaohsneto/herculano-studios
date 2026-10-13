import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "../config/env.js";

export const CONTACT_EMAIL = "herculanostudios@gmail.com";
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100).regex(/^[^\r\n\x00-\x1f]+$/),
  email: z.string().trim().email().max(254),
  topic: z.enum(["Projeto personalizado", "Beats e licenças", "Drum kits e produtos", "Ajuda com um pedido", "Parcerias", "Outro assunto"]),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional().default("")
});
export type ContactMessage = z.infer<typeof contactSchema>;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function contactEmail(data: ContactMessage) {
  const name = escapeHtml(data.name);
  const email = escapeHtml(data.email);
  const topic = escapeHtml(data.topic);
  const replyLink = `mailto:${encodeURIComponent(data.email)}`;
  return {
    to: CONTACT_EMAIL,
    replyTo: { name: data.name, address: data.email },
    subject: `${data.name} — ${data.topic} | Contato do site`,
    text: `Novo contato — Herculano Studios\n\nNome: ${data.name}\nEmail: ${data.email}\nAssunto: ${data.topic}\n\n${data.message}\n\nResponda a este email para conversar com ${data.name}.`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#18161f;font-family:Arial,Helvetica,sans-serif;color:#fff8f7"><div style="display:none;max-height:0;overflow:hidden">Novo contato: ${topic}.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#18161f;padding:32px 16px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border:1px solid #48434f;background:#282634"><tr><td style="padding:32px;border-top:4px solid #ff665d"><div style="font-size:24px;font-weight:900;color:#fff8f7">H<span style="color:#ff665d">•</span>S</div><p style="color:#ff665d;font-size:11px;letter-spacing:2px;margin-top:32px">NOVA MENSAGEM / CONTATO</p><h1 style="font-size:32px;line-height:1.15;letter-spacing:-1px;color:#fff8f7">Novo contato</h1><p style="color:#c8bec0;line-height:1.7;margin-bottom:6px">${name} entrou em contato pelo site.</p><a href="${replyLink}" style="color:#ff665d;font-size:14px;line-height:1.7;word-break:break-all">${email}</a></td></tr><tr><td style="padding:0 32px 32px"><p style="font-size:10px;letter-spacing:2px;color:#c8bec0">MENSAGEM</p><div style="font-size:16px;line-height:1.8;color:#fff8f7;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(data.message).replace(/\r?\n/g, "<br>")}</div><p style="margin-top:32px"><a href="${replyLink}" style="display:inline-block;background:#ff665d;color:#18161f;padding:16px 24px;text-decoration:none;font-weight:bold;font-size:13px">Responder a mensagem →</a></p><p style="font-size:12px;line-height:1.7;color:#c8bec0">Você também pode usar “Responder” no seu aplicativo de email.</p></td></tr><tr><td style="padding:24px 32px;border-top:1px solid #48434f;color:#c8bec0;font-size:11px;line-height:1.7">HERCULANO STUDIOS<br>Mensagem enviada pelo formulário de contato do site.</td></tr></table></td></tr></table></body></html>`
  };
}

type ContactTransport = {
  sendMail: (message: ReturnType<typeof contactEmail> & { from: { name: string; address: string } }) => Promise<{ accepted: unknown[] }>;
};

export function createContactSender(transport: ContactTransport | null, senderEmail: string) {
  return async (data: ContactMessage) => {
    if (!transport) throw new Error("SMTP_NOT_CONFIGURED");
    const result = await transport.sendMail({
      ...contactEmail(data),
      from: { name: "Herculano Studios • Site", address: senderEmail }
    });
    if (!result.accepted.some(address => String(address).toLowerCase() === CONTACT_EMAIL)) {
      throw new Error("SMTP_RECIPIENT_REJECTED");
    }
  };
}

// Google displays app passwords in groups; remove those spaces only for Gmail.
const password = env.SMTP_HOST === "smtp.gmail.com"
  ? env.SMTP_PASS?.replace(/\s/g, "") : env.SMTP_PASS;
export const transport = env.SMTP_HOST && env.SMTP_USER && password
  ? nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465,
      auth: { user: env.SMTP_USER, pass: password },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      disableFileAccess: true, disableUrlAccess: true
    }) : null;

export const contactConfigured = () => Boolean(transport);
export const sendContact = createContactSender(transport, env.SMTP_FROM || env.SMTP_USER || CONTACT_EMAIL);
