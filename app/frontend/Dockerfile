# syntax=docker/dockerfile:1
#
# Consolidates the former app/frontend/Dockerfile(.dev) and staging/Dockerfile.frontend.
# The build context is the repo ROOT because the production build needs the shared
# plugins/ dir; app/frontend/Dockerfile.dockerignore trims that context. The
# environment picks a stage via `build.target`:
#   development -> deps only; source + plugins are bind-mounted at runtime (Vite dev server)
#   production  -> full SvelteKit (adapter-node) build + plugin frontends baked in

# ---- base ----
FROM node:24-bullseye-slim AS base
RUN npm install -g pnpm@10.15.1
ENV APP_PATH=/app/frontend
WORKDIR $APP_PATH

# ---- development ----
FROM base AS development
COPY app/frontend/package.json app/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app/frontend/ ./
RUN pnpm svelte-kit sync
# dev-entrypoint.sh (bind-mounted) symlinks plugins, then runs this command
CMD ["pnpm", "run", "dev"]

# ---- production (mirrors the previous staging/Dockerfile.frontend) ----
FROM base AS production
ENV NODE_ENV=production
COPY app/frontend/package.json app/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app/frontend/ ./
RUN pnpm svelte-kit sync && pnpm run build:parser
ARG VITE_IDAH_HOST=http://localhost:8080
RUN VITE_IDAH_HOST=${VITE_IDAH_HOST} pnpm run build --mode production
# Build the plugin frontends that ship with the app (served via the frontend_plugins volume)
COPY plugins ./plugins
RUN cd plugins/idah-video/frontend && pnpm install --frozen-lockfile && pnpm run build
RUN cd plugins/idah-image/frontend && pnpm install --frozen-lockfile && pnpm run build
# Drop build-only assets (source static/ is already compiled into build/)
RUN rm -rf static emailTemplates
CMD ["node", "build/index.js"]
