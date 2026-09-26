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

FROM ruby:3.4.2-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get install -y \
    # Basic build tools
    build-essential \
    pkg-config \
    # FFmpeg and its dependencies
    ffmpeg \
    # ImageMagick and its dependencies
    imagemagick \
    libmagickwand-dev \
    # pgSQL client libraries
    libpq-dev \
    # Additional useful packages
    curl \
    wget \
    git \
    # Clean up apt cache to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Build arguments
ARG BUNDLE_WITHOUT="development test"
# Published images run in production; compose and staging pass their own value.
ARG APP_ENVIRONMENT=production

ENV APP_ENVIRONMENT="$APP_ENVIRONMENT"
ENV PORT=3000

RUN mkdir -p /app

WORKDIR /app

COPY app/setting/Gemfile* .

RUN bundle config set force_ruby_platform true
RUN bundle config set --local without "$BUNDLE_WITHOUT"
RUN bundle install --jobs 20 --retry 5

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
