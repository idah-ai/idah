# syntax=docker/dockerfile:1
#
# Multi-stage build. The environment picks a stage via `build.target`:
#   development -> all gem groups, dev entrypoint (source bind-mounted at runtime)
#   production  -> prod gems only, source baked in, migrate + puma
# See compose.override.yaml (dev) and compose.staging.yaml / compose.prod.yaml.

# ---- base: shared runtime + system deps ----
FROM ruby:3.4.2-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    BUNDLE_SILENCE_ROOT_WARNING=1 \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      pkg-config \
      libpq-dev \
      curl \
      wget \
      git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN bundle config set force_ruby_platform true

# ---- development ----
FROM base AS development

ENV APP_ENVIRONMENT=development

COPY Gemfile* ./
RUN bundle install --jobs 20 --retry 5

COPY . .

CMD ["./dev-entrypoint.sh", "puma"]

# ---- production ----
FROM base AS production

ENV APP_ENVIRONMENT=production

COPY Gemfile* ./
RUN bundle config set --local without "development test" \
 && bundle install --jobs 20 --retry 5

COPY . .

CMD ["bundle", "exec", "puma"]
