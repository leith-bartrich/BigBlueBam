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
COPY apps/brief/package.json ./apps/brief/
COPY apps/bolt/package.json ./apps/bolt/
COPY apps/bearing/package.json ./apps/bearing/
COPY apps/board/package.json ./apps/board/
COPY apps/bond/package.json ./apps/bond/
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

# Brief frontend
COPY apps/brief/src ./apps/brief/src
COPY apps/brief/public ./apps/brief/public
COPY apps/brief/index.html ./apps/brief/
COPY apps/brief/tsconfig.json apps/brief/tsconfig.node.json apps/brief/vite.config.ts ./apps/brief/

# Bolt frontend
COPY apps/bolt/src ./apps/bolt/src
COPY apps/bolt/public ./apps/bolt/public
COPY apps/bolt/index.html ./apps/bolt/
COPY apps/bolt/tsconfig.json apps/bolt/tsconfig.node.json apps/bolt/vite.config.ts ./apps/bolt/

# Bearing frontend
COPY apps/bearing/src ./apps/bearing/src
COPY apps/bearing/public ./apps/bearing/public
COPY apps/bearing/index.html ./apps/bearing/
COPY apps/bearing/tsconfig.json apps/bearing/tsconfig.node.json apps/bearing/vite.config.ts ./apps/bearing/

# Board frontend
COPY apps/board/src ./apps/board/src
COPY apps/board/public ./apps/board/public
COPY apps/board/index.html ./apps/board/
COPY apps/board/tsconfig.json apps/board/tsconfig.node.json apps/board/vite.config.ts ./apps/board/

# Bond frontend
COPY apps/bond/src ./apps/bond/src
COPY apps/bond/public ./apps/bond/public
COPY apps/bond/index.html ./apps/bond/
COPY apps/bond/tsconfig.json apps/bond/tsconfig.node.json apps/bond/vite.config.ts ./apps/bond/

RUN pnpm --filter @bigbluebam/shared build \
 && pnpm --filter @bigbluebam/frontend build \
 && pnpm --filter @bigbluebam/helpdesk build \
 && pnpm --filter @bigbluebam/banter build \
 && pnpm --filter @bigbluebam/beacon build \
 && pnpm --filter @bigbluebam/brief build \
 && pnpm --filter @bigbluebam/bolt build \
 && pnpm --filter @bigbluebam/bearing build \
 && pnpm --filter @bigbluebam/board build \
 && pnpm --filter @bigbluebam/bond build

# ── Stage: production ────────────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html/b3
COPY --from=build /app/apps/helpdesk/dist /usr/share/nginx/html/helpdesk
COPY --from=build /app/apps/banter/dist /usr/share/nginx/html/banter
COPY --from=build /app/apps/beacon/dist /usr/share/nginx/html/beacon
COPY --from=build /app/apps/brief/dist /usr/share/nginx/html/brief
COPY --from=build /app/apps/bolt/dist /usr/share/nginx/html/bolt
COPY --from=build /app/apps/bearing/dist /usr/share/nginx/html/bearing
COPY --from=build /app/apps/board/dist /usr/share/nginx/html/board
COPY --from=build /app/apps/bond/dist /usr/share/nginx/html/bond
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
