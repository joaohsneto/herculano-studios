import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens.js";

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.hs_access as string | undefined;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ message: "Autenticação necessária." });
    const claims = await verifyAccessToken(token);
    req.auth = { userId: claims.sub, email: claims.email, role: claims.role };
    next();
  } catch {
    res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") return res.status(403).json({ message: "Acesso administrativo necessário." });
  next();
}
