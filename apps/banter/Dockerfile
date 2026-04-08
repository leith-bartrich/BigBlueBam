# ── Stage: deps ───────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/banter/package.json ./apps/banter/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --no-frozen-lockfile

# ── Stage: build ──────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/

COPY apps/banter/src ./apps/banter/src
COPY apps/banter/public ./apps/banter/public
COPY apps/banter/index.html ./apps/banter/
COPY apps/banter/tsconfig.json apps/banter/tsconfig.node.json apps/banter/vite.config.ts ./apps/banter/

RUN pnpm --filter @bigbluebam/shared build \
 && pnpm --filter @bigbluebam/banter build

# ── Stage: production ────────────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=build /app/apps/banter/dist /usr/share/nginx/html/banter

# Simple nginx config for SPA
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  location /banter/ {\n\
    try_files $uri $uri/ /banter/index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
