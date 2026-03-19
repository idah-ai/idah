FROM ruby:3.4.2-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

RUN apt-get update && apt-get install -y \
    # Basic build tools
    build-essential \
    pkg-config \
    # Handle media processing
    file \
    # pgSQL client libraries
    libpq-dev \
    # Additional useful packages
    curl \
    git \
    tar \
    # Clean up apt cache to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Build arguments
ARG TARGETARCH
ARG UPDCLI_VERSION=v0.1.0
ARG BUNDLE_WITHOUT="development test"
ARG APP_ENVIRONMENT

ENV APP_ENVIRONMENT="$APP_ENVIRONMENT"
ENV PORT=3000

RUN mkdir -p /app

WORKDIR /app

COPY app/sync/Gemfile* .

RUN bundle config set force_ruby_platform true
RUN bundle config set --local without "$BUNDLE_WITHOUT"
RUN bundle install --jobs 20 --retry 5

COPY app/sync/ .

# Copy and extract updcli binary based on architecture
COPY updcli/updcli-${UPDCLI_VERSION}.tar.gz /tmp/updcli.tar.gz

RUN ARCH=${TARGETARCH} && \
    if [ "$ARCH" = "amd64" ]; then ARCH_SUFFIX="amd64"; \
    elif [ "$ARCH" = "arm64" ]; then ARCH_SUFFIX="arm64"; \
    else echo "Unsupported architecture: $ARCH" && exit 1; fi && \
    echo "Extracting updcli for architecture: ${ARCH_SUFFIX}..." && \
    mkdir -p /tmp/updcli && \
    tar -xf /tmp/updcli.tar.gz -C /tmp/updcli && \
    cp /tmp/updcli/updcli-linux-${ARCH_SUFFIX} /usr/local/bin/updcli-static && \
    chmod +x /usr/local/bin/updcli-static && \
    rm -rf /tmp/updcli.tar.gz /tmp/updcli

CMD ["bundle", "exec", "puma"]
