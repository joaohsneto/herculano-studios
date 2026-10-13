FROM node:24-bookworm-slim AS base
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
FROM base AS development
COPY package.json ./
COPY pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
RUN pnpm prisma:generate
CMD ["pnpm", "dev"]
FROM base AS build
COPY package.json ./
COPY pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
RUN pnpm prisma:generate && pnpm build
FROM node:24-bookworm-slim AS production
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
CMD ["node", "dist/src/server.js"]
