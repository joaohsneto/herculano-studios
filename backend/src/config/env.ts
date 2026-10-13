import { z } from "zod";

const schema = z.object({
  AUTH_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.union([z.email(), z.literal("")]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  PRIVATE_STORAGE_PATH: z.string().default("./storage/private"),
  PREVIEW_STORAGE_PATH: z.string().default("./storage/previews")
});

export const env = schema.parse(process.env);
