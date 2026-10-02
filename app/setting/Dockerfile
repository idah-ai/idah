# syntax=docker/dockerfile:1

# Build the plugin frontend bundles this service serves (Plugins::Service#serve_file).
FROM node:24-alpine AS plugin-frontends

RUN npm install -g pnpm@10.15.1

COPY --exclude=*/backends plugins/ /plugins/

RUN set -e; \
    for frontend in /plugins/*/frontend; do \
      plugin="$(basename "$(dirname "$frontend")")"; \
      cd "$frontend"; \
      pnpm install --frozen-lockfile; \
      pnpm run build; \
      mkdir -p "/out/$plugin/frontend"; \
      cp -r build "/out/$plugin/frontend/"; \
    done

# What the service needs to run, and nothing it only needs to build: the
# published image is this plus the gems and the code.
FROM ruby:3.4.2-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    # PostgreSQL client library, for the pg gem
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Published images run in production; compose and staging pass their own value.
ARG APP_ENVIRONMENT=production

ENV APP_ENVIRONMENT="$APP_ENVIRONMENT"
ENV PORT=3000

WORKDIR /app

# Compilers and headers for the native gems. Development runs this stage
# (target: build in compose.override.yml), since it installs gems when the
# container starts.
FROM base AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libpq-dev \
    # Gems fetched from GitHub
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

ARG BUNDLE_WITHOUT="development test"

COPY app/setting/Gemfile* .

RUN bundle config set force_ruby_platform true \
    && bundle config set --local without "$BUNDLE_WITHOUT" \
    && bundle install --jobs 20 --retry 5 \
    # The downloaded .gem archives; the installed gems are what runs.
    && rm -rf /usr/local/bundle/cache/*.gem

FROM base

# The gems and bundler's configuration: the ruby image keeps both here.
COPY --from=build /usr/local/bundle /usr/local/bundle

# The shared library, loaded from /common by config/boot.rb (COMMON_PATH).
COPY common/ /common/

COPY app/setting/ .

# Plugins, minus their frontend sources, plus the frontend bundles built
# above, found in /plugins by PluginSystem.default_path.
COPY --exclude=*/frontend plugins/ /plugins/
COPY --from=plugin-frontends /out/ /plugins/

# Stamped by the release workflow. Without them the service reports 0.0.0-dev.
ARG IDAH_VERSION
ARG IDAH_GIT_SHA
ENV IDAH_VERSION="$IDAH_VERSION"
ENV IDAH_GIT_SHA="$IDAH_GIT_SHA"

CMD ["bundle", "exec", "puma"]
