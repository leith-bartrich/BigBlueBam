# Marketing site container.
#
# Builds the Vite app under ./site (private, gitignored — loaded from its own
# git repo by contributors who have access) and serves the result as a static
# Node.js process on port 3000. Nginx in front proxies `/` to this service.
#
# This Dockerfile lives under infra/site/ (NOT under ./site) so it is never
# part of the private site repo and stays with the public BBB repo.
FROM node:22-alpine AS builder
WORKDIR /build
# Copy manifest first for better layer caching.
COPY site/package.json ./package.json
COPY site/package-lock.json* ./
RUN npm install --no-audit --no-fund
# Now bring in the rest of the sources and build.
COPY site/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14 --no-audit --no-fund
COPY --from=builder /build/dist ./dist
EXPOSE 3000
# `-s` = SPA-style fallback to index.html for unknown paths.
# Shell form (not exec form) so `${PORT:-3000}` is interpolated by /bin/sh:
# Railway sets $PORT to a randomly-assigned port and routes its healthcheck
# there. Hardcoding -l 3000 made the healthcheck unreachable and the
# deployment fail. Local docker-compose still gets 3000 via the fallback.
CMD sh -c 'serve -s dist -l ${PORT:-3000}'
