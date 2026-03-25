# Multi-stage Dockerfile for production deployment
# Stage 1: Generate OpenAPI documentation
FROM ruby:3.4.2-slim AS openapi-generator

ENV APP_PATH=/idah
ENV DEBIAN_FRONTEND=noninteractive
ENV BUNDLE_SILENCE_ROOT_WARNING=1

WORKDIR $APP_PATH

# Install dependencies required for Ruby services
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    ffmpeg \
    imagemagick \
    libmagickwand-dev \
    libpq-dev \
    curl \
    wget \
    git \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configure bundler
RUN mkdir -p /vendor/bundle
RUN bundle config set --local path /vendor/bundle
RUN bundle config set force_ruby_platform true

# Copy application code
COPY ./app ./app
COPY ./common ./common
COPY ./bin/all_services ./bin/all_services
COPY ./doc/bin/generate_openapi ./bin/generate_openapi

# Install dependencies for all services
RUN ./bin/all_services bundle install

# Generate OpenAPI documentation
RUN mkdir -p /openapi && ./bin/generate_openapi

# Stage 2: Build frontend with OpenAPI docs
FROM node:24-alpine AS frontend-builder

# Build argument for site URL (can be overridden)
ARG SITE_URL=http://localhost:8080

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files first for better caching
COPY ./doc/frontend/package.json ./doc/frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy OpenAPI documentation from previous stage
COPY --from=openapi-generator /openapi ./public/data

# Copy frontend source code
COPY ./doc/frontend .

# Set SITE_URL environment variable from build arg
ENV SITE_URL=$SITE_URL

# Build the frontend
RUN pnpm run build

# Build pagefind search index
RUN pnpm run build:pagefind

# Stage 3: Production nginx server
FROM nginx:alpine AS production

# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration with trailing slash redirect
COPY ./doc/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
