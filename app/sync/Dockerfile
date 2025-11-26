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
    unzip \
    # Clean up apt cache to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# download duckDB lib dependency
RUN wget https://github.com/duckdb/duckdb/releases/download/v1.4.2/libduckdb-linux-amd64.zip \
&& unzip libduckdb-linux-amd64.zip \
&& mv duckdb.* /usr/local/include/ \
&& mv libduckdb.so /usr/local/lib \
&& rm libduckdb*

# Build arguments
ARG BUNDLE_WITHOUT="development test"
ARG APP_ENVIRONMENT

ENV APP_ENVIRONMENT="$APP_ENVIRONMENT"
ENV PORT=3000

RUN mkdir -p /app

WORKDIR /app

COPY Gemfile* .

RUN bundle config set force_ruby_platform true
RUN bundle config set --local without "$BUNDLE_WITHOUT"
RUN bundle install --jobs 20 --retry 5

COPY . .

CMD ["bundle", "exec", "puma"]
