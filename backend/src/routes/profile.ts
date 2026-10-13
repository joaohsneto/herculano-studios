import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { authAttempts } from "../middleware/auth-attempts.js";
import { env } from "../config/env.js";

import { emailSchema } from "../auth/config.js";
import { emailChangeConfigured, emailCodeHash, newEmailCode, sendEmailChange } from "../services/email-change.js";

export function createProfileRouter(sendCode = sendEmailChange, emailConfigured = emailChangeConfigured) {
const router = Router();
const selection = { name: true, email: true, phone: true, company: true, role: true, passwordHash: true, googleId: true } as const;
const profile = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).refine(value => !value || (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 10)),
  company: z.string().trim().max(150)
}).strict();
const password = z.object({
  currentPassword: z.string().min(1).max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72),
  newPassword: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
}).strict().refine(value => value.currentPassword !== value.newPassword);

router.use(requireAuth);
router.use((req, res, next) => {
  if (req.method !== "GET") {
    if (req.headers.origin !== new URL(env.FRONTEND_URL).origin) return res.status(403).json({ message: "Origem da solicitação não permitida." });
    if (!req.is("application/json")) return res.status(415).json({ message: "Formato de solicitação inválido." });
  }
  next();
});
router.get("/", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: selection });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    const { passwordHash, googleId, ...data } = user;
    return res.json({ user: { ...data, hasPassword: Boolean(passwordHash), canChangeEmail: Boolean(passwordHash) && !googleId } });
  } catch { return res.status(503).json({ message: "Não foi possível carregar seus dados." }); }
});
router.patch("/", async (req, res) => {
  const input = profile.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revise o nome e o telefone. Informe o telefone com DDD." });
  try {
    const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: {
      name: input.data.name, phone: input.data.phone || null, company: input.data.company || null
    }, select: selection });
    const { passwordHash, googleId, ...data } = user;
    return res.json({ user: { ...data, hasPassword: Boolean(passwordHash), canChangeEmail: Boolean(passwordHash) && !googleId } });
  } catch { return res.status(503).json({ message: "Não foi possível salvar seus dados. Tente novamente." }); }
});
router.post("/password", authAttempts(), async (req, res) => {
  const input = password.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Use uma senha diferente, com 8 a 72 caracteres, maiúscula, minúscula, número e símbolo." });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { passwordHash: true } });
    if (!user?.passwordHash) return res.status(400).json({ message: "A senha desta conta é gerenciada pelo Google." });
    if (!await bcrypt.compare(input.data.currentPassword, user.passwordHash)) return res.status(400).json({ message: "A senha atual está incorreta." });
    const passwordHash = await bcrypt.hash(input.data.newPassword, 12);
    // Compare-and-swap prevents concurrent requests from using an outdated password.
    const result = await prisma.user.updateMany({ where: { id: req.auth!.userId, passwordHash: user.passwordHash }, data: { passwordHash, pendingEmail: null, emailChangeHash: null, emailChangeExpiresAt: null, emailChangeAttempts: 0 } });
    if (!result.count) return res.status(409).json({ message: "Sua senha foi alterada. Tente novamente com a senha atual." });
    return res.json({ message: "Senha alterada com sucesso." });
  } catch { return res.status(503).json({ message: "Não foi possível alterar sua senha. Tente novamente." }); }
});
const emailInput = z.object({ email: emailSchema, currentPassword: z.string().min(1).max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72) }).strict();
const codeInput = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
const emailLimit = authAttempts();
router.post("/email", emailLimit, async (req, res) => {
  const input = emailInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Informe um e-mail válido e sua senha atual." });
  if (!emailConfigured()) return res.status(503).json({ message: "O envio de confirmação está indisponível. Tente novamente mais tarde." });
  const id = req.auth!.userId;
  let hash: string | undefined;
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.passwordHash || user.googleId) return res.status(400).json({ message: "O e-mail de contas Google é gerenciado pelo Google." });
    if (!await bcrypt.compare(input.data.currentPassword, user.passwordHash)) return res.status(400).json({ message: "A senha atual está incorreta." });
    if (input.data.email === user.email) return res.status(400).json({ message: "Informe um e-mail diferente do atual." });
    if (user.emailChangeExpiresAt && user.emailChangeExpiresAt.getTime() > Date.now() + 9 * 60_000) return res.status(429).json({ message: "Aguarde um minuto antes de solicitar outro código." });
    if (await prisma.user.findUnique({ where: { email: input.data.email }, select: { id: true } })) return res.status(409).json({ message: "Não é possível usar este e-mail." });
    const code = newEmailCode(); hash = emailCodeHash(id, input.data.email, code);
    const reserved = await prisma.user.updateMany({ where: { id, passwordHash: user.passwordHash, OR: [{ emailChangeExpiresAt: null }, { emailChangeExpiresAt: { lte: new Date(Date.now() + 9 * 60_000) } }] }, data: { pendingEmail: input.data.email, emailChangeHash: hash, emailChangeExpiresAt: new Date(Date.now() + 10 * 60_000), emailChangeAttempts: 0 } });
    if (!reserved.count) return res.status(409).json({ message: "Uma alteração já está em andamento. Aguarde um minuto e tente novamente." });
    await sendCode(input.data.email, code);
    return res.json({ message: "Enviamos um código para o novo e-mail. Ele expira em 10 minutos." });
  } catch {
    if (hash) await prisma.user.updateMany({ where: { id, emailChangeHash: hash }, data: { pendingEmail: null, emailChangeHash: null, emailChangeExpiresAt: null } }).catch(() => {});
    return res.status(503).json({ message: "Não foi possível enviar o código. Tente novamente." });
  }
});
router.post("/email/confirm", emailLimit, async (req, res) => {
  const input = codeInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Informe o código de seis dígitos." });
  const id = req.auth!.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.pendingEmail || !user.emailChangeHash || !user.emailChangeExpiresAt || user.emailChangeExpiresAt <= new Date() || user.emailChangeAttempts >= 5) return res.status(400).json({ message: "Código expirado ou indisponível. Solicite outro código." });
    // Consume an attempt atomically, including valid guesses, to cap concurrent guesses.
    const attempt = await prisma.user.updateMany({ where: { id, emailChangeHash: user.emailChangeHash, emailChangeAttempts: { lt: 5 }, emailChangeExpiresAt: { gt: new Date() } }, data: { emailChangeAttempts: { increment: 1 } } });
    if (!attempt.count || emailCodeHash(id, user.pendingEmail, input.data.code) !== user.emailChangeHash) return res.status(400).json({ message: "Código inválido. Confira o código recebido ou solicite outro." });
    const result = await prisma.user.updateMany({ where: { id, email: user.email, emailChangeHash: user.emailChangeHash, emailChangeExpiresAt: { gt: new Date() } }, data: { email: user.pendingEmail, emailVerifiedAt: new Date(), pendingEmail: null, emailChangeHash: null, emailChangeExpiresAt: null, emailChangeAttempts: 0 } });
    if (!result.count) return res.status(409).json({ message: "Esta solicitação já foi usada. Atualize a página." });
    return res.json({ message: "E-mail alterado com sucesso.", email: user.pendingEmail });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return res.status(409).json({ message: "Não é possível usar este e-mail. Solicite outro código para um endereço diferente." });
    return res.status(503).json({ message: "Não foi possível confirmar o e-mail. Tente novamente." });
  }
});
return router;
}
export default createProfileRouter();
