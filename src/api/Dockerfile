# syntax=docker/dockerfile:1
# Build: deps + Prisma Client + Nest (API + workers na mesma imagem)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm config set fetch-retries 10 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

RUN --mount=type=cache,target=/root/.npm \
  npm install --ignore-scripts --no-audit --no-fund

COPY . .

RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

# Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=448

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Prisma CLI for migrations
RUN npm install prisma@6.19.2 --omit=dev --no-save --package-lock=false --no-audit --no-fund \
  && npm cache clean --force

EXPOSE 3000

CMD ["node", "dist/main"]
