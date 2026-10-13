import type { Request } from "express";
import { env } from "../config/env.js";

// Next.js proxies /api to Express. Auth.js must generate browser-facing URLs,
// without trusting Host / X-Forwarded-* values supplied by arbitrary clients.
export function canonicalAuthOrigin(req: Request) {
  const origin = new URL(env.FRONTEND_URL);
  req.headers.host = origin.host;
  req.headers["x-forwarded-host"] = origin.host;
  req.headers["x-forwarded-proto"] = origin.protocol.slice(0, -1);
  Object.defineProperty(req, "protocol", { value: origin.protocol.slice(0, -1), configurable: true });
}
