# historian — production image.
# Stages:
#   deps    — install all dependencies once
#   builder — next build (standalone output; no DB needed at build time,
#             verified: all pages are force-dynamic)
#   tools   — dev deps kept for drizzle-kit + tsx; compose uses this target
#             to run migrations + seed against the db before the app starts
#   runner  — the pruned standalone server, non-root

FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm exec next build

FROM deps AS tools
WORKDIR /app
COPY . .
# Usage: docker compose run --rm migrate   (command comes from compose)

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
