FROM ruby:3.4.2-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get install -y \
    # Basic build tools
    build-essential \
    pkg-config \
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
ARG APP_ENVIRONMENT

ENV APP_ENVIRONMENT="$APP_ENVIRONMENT"
ENV PORT=3000

RUN mkdir -p /app

WORKDIR /app

COPY app/audit/Gemfile* .

RUN bundle config set force_ruby_platform true
RUN bundle config set --local without "$BUNDLE_WITHOUT"
RUN bundle install --jobs 20 --retry 5

# The shared library, loaded from /common by config/boot.rb (COMMON_PATH).
COPY common/ /common/

COPY app/audit/ .

CMD ["bundle", "exec", "puma"]
