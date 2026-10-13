import type { NextFunction, Request, Response } from "express";
import { getSession } from "@auth/express";
import { authConfig } from "../auth/config.js";
import { canonicalAuthOrigin } from "../auth/origin.js";
import { z } from "zod";

const sessionUser = z.object({ id: z.string(), email: z.string(), role: z.enum(["ADMIN", "CUSTOMER"]) });
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "no-store");
  try {
    canonicalAuthOrigin(req);
    const session = await getSession(req, authConfig);
    const user = sessionUser.safeParse(session?.user);
    if (!user.success) return res.status(401).json({ message: "Autenticação necessária." });
    req.auth = { userId: user.data.id, email: user.data.email, role: user.data.role };
    next();
  } catch {
    res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") return res.status(403).json({ message: "Acesso administrativo necessário." });
  next();
}
