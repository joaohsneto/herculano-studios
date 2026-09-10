import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import mediaRoutes from "./routes/media.js";
import dashboardRoutes from "./routes/dashboard.js";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "herculano-studios-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api", dashboardRoutes);

app.use((_req, res) => res.status(404).json({ message: "Rota não encontrada." }));
