import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createOpaqueToken, hashToken, signAccessToken } from "../lib/tokens.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const credentials = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
});

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path: "/" };
}

async function issueSession(res: Parameters<typeof router.post>[1] extends never ? never : any, user: { id: string; email: string; role: "ADMIN" | "CUSTOMER" }) {
  const access = await signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refresh = createOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000);
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(refresh), userId: user.id, expiresAt } });
  res.cookie("hs_access", access, cookieOptions(15 * 60_000));
  res.cookie("hs_refresh", refresh, cookieOptions(env.REFRESH_TOKEN_DAYS * 86_400_000));
}

router.post("/register", async (req, res) => {
  const input = credentials.extend({ name: z.string().min(2).max(100) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revise nome, e-mail e senha.", issues: input.error.issues });
  const existing = await prisma.user.findUnique({ where: { email: input.data.email } });
  if (existing) return res.status(409).json({ message: "E-mail já cadastrado." });
  const user = await prisma.user.create({
    data: { name: input.data.name, email: input.data.email, passwordHash: await bcrypt.hash(input.data.password, 12) },
    select: { id: true, name: true, email: true, role: true }
  });
  await issueSession(res, user);
  res.status(201).json({ user });
});

router.post("/login", async (req, res) => {
  const input = credentials.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Credenciais inválidas." });
  const user = await prisma.user.findUnique({ where: { email: input.data.email } });
  if (!user?.passwordHash || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "E-mail ou senha incorretos." });
  }
  await issueSession(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post("/refresh", async (req, res) => {
  const raw = req.cookies?.hs_refresh as string | undefined;
  if (!raw) return res.status(401).json({ message: "Sessão não encontrada." });
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) return res.status(401).json({ message: "Sessão expirada." });
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  await issueSession(res, stored.user);
  res.status(204).send();
});

router.post("/logout", async (req, res) => {
  const raw = req.cookies?.hs_refresh as string | undefined;
  if (raw) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie("hs_access", { path: "/" });
  res.clearCookie("hs_refresh", { path: "/" });
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, name: true, email: true, role: true } });
  res.json({ user });
});

export default router;
