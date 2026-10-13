import { Router } from "express";
import { ExpressAuth } from "@auth/express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { authAttempts } from "../middleware/auth-attempts.js";
import { authConfig, emailSchema } from "../auth/config.js";
import { canonicalAuthOrigin } from "../auth/origin.js";

const router = Router();
const limitAttempts = authAttempts();
const registration = z.object({
  name: z.string().trim().min(2).max(100), email: emailSchema,
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
});

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.method === "POST" && req.headers.origin && req.headers.origin !== new URL(env.FRONTEND_URL).origin) {
    return res.status(403).json({ message: "Origem da solicitação não permitida." });
  }
  next();
});

router.post("/register", limitAttempts, async (req, res) => {
  // Registration remains application logic. Auth.js Credentials owns sign-in.
  if (!req.is("application/json")) return res.status(415).json({ message: "Formato de solicitação inválido." });
  const input = registration.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "Revise nome, email e senha. Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo." });
  try {
    const user = await prisma.user.create({
      data: { name: input.data.name, email: input.data.email, passwordHash: await bcrypt.hash(input.data.password, 12) },
      select: { id: true, name: true, email: true, role: true }
    });
    return res.status(201).json({ user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return res.status(409).json({ message: "Este email já tem uma conta. Entre com sua senha ou com o Google." });
    }
    return res.status(503).json({ message: "Não foi possível concluir o cadastro. Tente novamente." });
  }
});
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, name: true, email: true, role: true } });
  res.json({ user });
});
router.use(["/callback/credentials", "/signin/google"], limitAttempts);
router.use((req, res, next) => {
  canonicalAuthOrigin(req);
  // Retire the previous session cookies; they no longer grant API access.
  if (req.cookies?.hs_access) res.clearCookie("hs_access", { path: "/" });
  if (req.cookies?.hs_refresh) res.clearCookie("hs_refresh", { path: "/" });
  if (req.cookies?.hs_google_flow) res.clearCookie("hs_google_flow", { path: "/api/auth/google" });
  next();
});
router.use(ExpressAuth(authConfig));
export default router;
