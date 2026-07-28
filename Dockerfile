# Self-hosted dağıtım imajı (Faz 6 Adım 4, S29). Yalnızca yerel
# `docker build`+`docker-compose up` ile doğrulanır — hiçbir yere deploy
# edilmez (D67/D72). Node sürümü CI ile aynı (.github/workflows), pnpm
# sürümü package.json > packageManager ile sabit.

FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DOCKER_BUILD=true
RUN pnpm build

# next.config.ts > output: "standalone" — yalnızca kullanılan bağımlılıklar
# .next/standalone'a kopyalanır, node_modules'ün tamamı imaja taşınmaz.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
