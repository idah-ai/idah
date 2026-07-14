# syntax=docker/dockerfile:1
#
# Multi-stage build. The environment picks a stage via `build.target`:
#   development -> all gem groups, dev entrypoint (source bind-mounted at runtime)
#   production  -> prod gems only, source baked in, migrate + puma
# See compose.override.yaml (dev) and compose.staging.yaml / compose.prod.yaml.
#
# updcli is NOT baked in. It is provided at runtime via an optional read-only
# mount of the repo's updcli/ dir (see install-updcli.sh + compose). That keeps
# updcli shareable across services and lets this image build from ./app/sync.

# ---- base: shared runtime + system deps ----
FROM ruby:3.4.2-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    BUNDLE_SILENCE_ROOT_WARNING=1 \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      pkg-config \
      file \
      libpq-dev \
      curl \
      git \
      tar \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN bundle config set force_ruby_platform true

# Optional updcli installer runs before the command; no-op if the mount is absent.
COPY install-updcli.sh /usr/local/bin/install-updcli
RUN chmod +x /usr/local/bin/install-updcli
ENTRYPOINT ["install-updcli"]

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
