import type { RequestHandler } from "express";
import { env } from "../config/env.js";

// Connection IP only: never trust arbitrary client forwarding headers.
// For multiple replicas, enforce a shared per-visitor limiter at the gateway.
export function authAttempts(): RequestHandler {
  const attempts = new Map<string, { count: number; expires: number }>();
  return (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method === "POST" && req.headers.origin && req.headers.origin !== new URL(env.FRONTEND_URL).origin) {
      res.status(403).json({ message: "Origem da solicitação não permitida." });
      return;
    }
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    const key = req.ip || "unknown";
    const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60_000 };
    if (entry.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
      res.set("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
      res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." });
      return;
    }
    entry.count++;
    attempts.set(key, entry);
    next();
  };
}
