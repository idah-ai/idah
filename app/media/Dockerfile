# syntax=docker/dockerfile:1

# What the service needs to run, and nothing it only needs to build: the
# published image is this plus the gems and the code.
FROM ruby:3.4.2-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    # PostgreSQL client library, for the pg gem
    libpq5 \
    # Shrine's determine_mime_type runs `file` on every upload
    file \
    # The video plugin runs ffmpeg and ffprobe
    ffmpeg \
    # ImageMagick, which the rmagick gem links against for the image plugin,
    # and its coders for SVG, DJVU, OpenEXR and WMF: the image plugin takes
    # any image/* upload
    libmagickwand-6.q16-6 \
    libmagickcore-6.q16-6-extra \
    && rm -rf /var/lib/apt/lists/*

# Published images run in production; the dev compose passes its own value.
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
    # ImageMagick's headers, to compile the rmagick gem
    libmagickwand-dev \
    # Gems fetched from GitHub
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

ARG BUNDLE_WITHOUT="development test"

COPY app/media/Gemfile* .

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

COPY app/media/ .

# Plugins, minus their frontend sources, found in /plugins by
# PluginSystem.default_path.
COPY --exclude=*/frontend plugins/ /plugins/

# Stamped by the release workflow. Without them the service reports 0.0.0-dev.
ARG IDAH_VERSION
ARG IDAH_GIT_SHA
ENV IDAH_VERSION="$IDAH_VERSION"
ENV IDAH_GIT_SHA="$IDAH_GIT_SHA"

CMD ["bundle", "exec", "puma"]
