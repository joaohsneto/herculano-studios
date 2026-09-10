import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type AccessClaims = { sub: string; role: "ADMIN" | "CUSTOMER"; email: string };

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub || typeof payload.email !== "string" || (payload.role !== "ADMIN" && payload.role !== "CUSTOMER")) {
    throw new Error("Token inválido");
  }
  return { sub: payload.sub, email: payload.email, role: payload.role };
}

export function createOpaqueToken() {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
