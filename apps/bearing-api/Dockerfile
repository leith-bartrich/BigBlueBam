# ── Stage: deps ───────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/bearing-api/package.json ./apps/bearing-api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --no-frozen-lockfile

# ── Stage: build ──────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/
COPY apps/bearing-api/src ./apps/bearing-api/src
COPY apps/bearing-api/tsconfig.json apps/bearing-api/tsup.config.ts ./apps/bearing-api/

RUN pnpm --filter @bigbluebam/shared build \
 && pnpm --filter @bigbluebam/bearing-api build

# Create a deploy-ready directory with all prod deps
RUN pnpm --filter @bigbluebam/bearing-api deploy --prod /app/deployed


# ── Stage: dev ────────────────────────────────────────────────────
FROM deps AS dev

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/bearing-api/ ./apps/bearing-api/

WORKDIR /app/apps/bearing-api

EXPOSE 4007

CMD ["npx", "tsx", "watch", "src/server.ts"]

# ── Stage: production ────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache tini curl

WORKDIR /app

RUN addgroup -g 1001 -S bbam \
 && adduser -S bbam -u 1001 -G bbam

COPY --from=build /app/deployed/node_modules ./node_modules
COPY --from=build /app/apps/bearing-api/dist ./dist
COPY --from=build /app/deployed/package.json ./
COPY infra/postgres/migrations/ ./migrations/

RUN chown -R bbam:bbam /app

USER bbam

EXPOSE 4007

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
