# -- Stage: deps ---------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/helpdesk/package.json ./apps/helpdesk/

RUN pnpm install --no-frozen-lockfile

# -- Stage: build --------------------------------------------------------------
FROM deps AS build

COPY tsconfig.base.json ./
COPY apps/helpdesk/src ./apps/helpdesk/src
COPY apps/helpdesk/public ./apps/helpdesk/public
COPY apps/helpdesk/index.html ./apps/helpdesk/
COPY apps/helpdesk/tsconfig.json apps/helpdesk/tsconfig.node.json apps/helpdesk/vite.config.ts ./apps/helpdesk/

RUN pnpm --filter @bigbluebam/helpdesk build

# -- Stage: production ---------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=build /app/apps/helpdesk/dist /usr/share/nginx/html
COPY infra/nginx/helpdesk.conf /etc/nginx/conf.d/default.conf

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
