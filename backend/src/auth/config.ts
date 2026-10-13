import type { ExpressAuthConfig } from "@auth/express";
import Google from "@auth/express/providers/google";
import Credentials from "@auth/express/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const safeUser = { id: true, name: true, email: true, role: true } as const;
export const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
export const googleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const passwordCredentials = z.object({ email: emailSchema, password: z.string().min(1).max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72) });

export const authConfig: ExpressAuthConfig = {
  basePath: "/api/auth",
  secret: env.AUTH_SECRET || env.JWT_SECRET,
  trustHost: true, // Request origin is pinned to FRONTEND_URL by canonicalAuthOrigin.
  useSecureCookies: new URL(env.FRONTEND_URL).protocol === "https:",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw) {
        const input = passwordCredentials.safeParse(raw);
        if (!input.success) return null;
        const user = await prisma.user.findUnique({ where: { email: input.data.email } });
        if (!user?.passwordHash || !await bcrypt.compare(input.data.password, user.passwordHash)) return null;
        return { id: user.id, name: user.name, email: user.email };
      }
    }),
    ...(googleConfigured() ? [Google({
      clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!,
      checks: ["pkce", "state", "nonce"],
      authorization: { params: { scope: "openid email profile", prompt: "select_account" } }
    })] : [])
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (profile?.email_verified !== true || !account.providerAccountId) return false;
      const email = emailSchema.safeParse(profile.email);
      if (!email.success) return false;
      // Preserve existing identities; never join accounts solely by matching email.
      const linked = await prisma.user.findUnique({ where: { googleId: account.providerAccountId }, select: safeUser });
      if (linked) return true;
      const existing = await prisma.user.findUnique({ where: { email: email.data }, select: { id: true } });
      if (existing) return "/login?authError=account_exists";
      try {
        await prisma.user.create({ data: {
          googleId: account.providerAccountId, email: email.data,
          name: (typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : email.data.split("@")[0]!).slice(0, 100),
          emailVerifiedAt: new Date()
        } });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") return "/login?authError=account_exists";
        throw error;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const local = await prisma.user.findUniqueOrThrow({ where: { googleId: account.providerAccountId }, select: safeUser });
        token.sub = local.id;
      } else if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) throw new Error("Invalid session");
      // Resolve current permissions from the database; never trust a client role.
      const user = await prisma.user.findUniqueOrThrow({ where: { id: token.sub }, select: safeUser });
      return { ...session, user };
    },
    async redirect({ url }) {
      const origin = new URL(env.FRONTEND_URL).origin;
      try {
        const target = new URL(url, origin);
        return target.origin === origin ? target.href : `${origin}/account`;
      } catch { return `${origin}/account`; }
    }
  },
  logger: {
    // Do not log OAuth codes, tokens, credentials or provider response bodies.
    error(error) { console.error("[auth]", "type" in error && typeof error.type === "string" ? error.type : "AuthError"); },
    warn(code) { console.warn("[auth]", code); },
    debug() {}
  }
};
