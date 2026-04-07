# ── Stage: deps ───────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/helpdesk/package.json ./apps/helpdesk/
COPY apps/banter/package.json ./apps/banter/
COPY apps/beacon/package.json ./apps/beacon/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --no-frozen-lockfile

# ── Stage: build ──────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/

# BBB frontend
COPY apps/frontend/src ./apps/frontend/src
COPY apps/frontend/public ./apps/frontend/public
COPY apps/frontend/index.html ./apps/frontend/
COPY apps/frontend/tsconfig.json apps/frontend/tsconfig.node.json apps/frontend/vite.config.ts ./apps/frontend/

# Helpdesk frontend
COPY apps/helpdesk/src ./apps/helpdesk/src
COPY apps/helpdesk/public ./apps/helpdesk/public
COPY apps/helpdesk/index.html ./apps/helpdesk/
COPY apps/helpdesk/tsconfig.json apps/helpdesk/tsconfig.node.json apps/helpdesk/vite.config.ts ./apps/helpdesk/

# Banter frontend
COPY apps/banter/src ./apps/banter/src
COPY apps/banter/public ./apps/banter/public
COPY apps/banter/index.html ./apps/banter/
COPY apps/banter/tsconfig.json apps/banter/tsconfig.node.json apps/banter/vite.config.ts ./apps/banter/

# Beacon frontend
COPY apps/beacon/src ./apps/beacon/src
COPY apps/beacon/public ./apps/beacon/public
COPY apps/beacon/index.html ./apps/beacon/
COPY apps/beacon/tsconfig.json apps/beacon/tsconfig.node.json apps/beacon/vite.config.ts ./apps/beacon/

RUN pnpm --filter @bigbluebam/shared build \
 && pnpm --filter @bigbluebam/frontend build \
 && pnpm --filter @bigbluebam/helpdesk build \
 && pnpm --filter @bigbluebam/banter build \
 && pnpm --filter @bigbluebam/beacon build

# ── Stage: production ────────────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html/b3
COPY --from=build /app/apps/helpdesk/dist /usr/share/nginx/html/helpdesk
COPY --from=build /app/apps/banter/dist /usr/share/nginx/html/banter
COPY --from=build /app/apps/beacon/dist /usr/share/nginx/html/beacon
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
