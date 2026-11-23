FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Required by prisma.config.ts during generate/build (real URL comes at runtime)
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lets_connect?schema=public
ENV NEXT_PUBLIC_CLOUD_RADIUS_IP=18.199.177.29
ENV NEXT_PUBLIC_APP_URL=http://tech-spherewifi.xyz
ENV NEXT_PUBLIC_APP_HOST=tech-spherewifi.xyz
ENV NEXT_PUBLIC_PORTAL_URL=http://18.199.177.29
ENV PORTAL_DOMAIN=tech-spherewifi.xyz
ENV CLOUD_RADIUS_IP=18.199.177.29
ENV RADIUS_HOST=18.199.177.29
# Small VPS: raise heap + fewer workers (pair with swap on host)
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV NEXT_DISABLE_SWC_WASM=1
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY deploy/web-entrypoint.sh /web-entrypoint.sh
RUN chmod +x /web-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lets_connect?schema=public
CMD ["/web-entrypoint.sh"]
