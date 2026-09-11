import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  PRIVATE_STORAGE_PATH: z.string().default("./storage/private"),
  PREVIEW_STORAGE_PATH: z.string().default("./storage/previews")
});

export const env = schema.parse(process.env);
