# ── Stage: deps ───────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/brief-api/package.json ./apps/brief-api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --no-frozen-lockfile

# ── Stage: build ──────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/
COPY apps/brief-api/src ./apps/brief-api/src
COPY apps/brief-api/tsconfig.json apps/brief-api/tsup.config.ts ./apps/brief-api/

RUN pnpm --filter @bigbluebam/shared build \
 && pnpm --filter @bigbluebam/brief-api build

# Create a deploy-ready directory with all prod deps
RUN pnpm --filter @bigbluebam/brief-api deploy --prod /app/deployed


# ── Stage: dev ────────────────────────────────────────────────────
FROM deps AS dev

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/brief-api/ ./apps/brief-api/

WORKDIR /app/apps/brief-api

EXPOSE 4005

CMD ["npx", "tsx", "watch", "src/server.ts"]

# ── Stage: production ────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache tini curl

WORKDIR /app

RUN addgroup -g 1001 -S bbam \
 && adduser -S bbam -u 1001 -G bbam

COPY --from=build /app/deployed/node_modules ./node_modules
COPY --from=build /app/apps/brief-api/dist ./dist
COPY --from=build /app/deployed/package.json ./
COPY infra/postgres/migrations/ ./migrations/

RUN chown -R bbam:bbam /app

USER bbam

EXPOSE 4005

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
