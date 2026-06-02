# Development Guide

This guide covers everything you need to know to set up, run, test, and contribute to the IDAH platform.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Running Individual Services](#running-individual-services)
- [Database Management](#database-management)
  - [Initialize / Reset all databases](#initialize--reset-all-databases)
  - [Reset a single service](#reset-a-single-service)
  - [Run migrations](#run-migrations)
  - [Prepare test databases](#prepare-test-databases)
- [Testing](#testing)
  - [Backend (Ruby / RSpec)](#backend-ruby--rspec)
  - [Frontend (SvelteKit / Vitest)](#frontend-sveltekit--vitest)
  - [Running CI checks locally](#running-ci-checks-locally)
- [Working on Backend Services](#working-on-backend-services)
  - [Service structure](#service-structure)
  - [Adding a new migration](#adding-a-new-migration)
  - [Running a console](#running-a-console)
  - [Using `bin/dev` and `bin/reset`](#using-bindev-and-binreset)
- [Working on the Frontend](#working-on-the-frontend)
- [Plugin Development](#plugin-development)
- [Environment Variables](#environment-variables)
- [Common Troubleshooting](#common-troubleshooting)

---

## Architecture Overview

IDAH is a **microservices architecture** composed of the following services:

```
idah/
├── app/
│   ├── frontend/         # Web UI (SvelteKit, TypeScript, Tailwind CSS)
│   ├── iam/             # Identity & Access Management
│   ├── dataset/         # Dataset management service
│   ├── media/           # Media processing service (images, video, audio)
│   ├── sync/            # Data export & sync service
│   ├── notification/    # Notification service
│   ├── audit/           # Audit logging service
│   └── setting/         # Settings management
├── common/              # Shared code, utilities, rake tasks, gems
├── plugins/            # Production plugins
├── plugins_dev/        # Plugin development CLI & templates
├── dev/                # Dev infrastructure (nginx config, ssl, rake tasks)
├── doc/                # Documentation assets
└── staging/            # Staging environment config
```

**Key technologies:**
- **Backend:** Ruby 3.4, [Verse framework](https://github.com/verse-rb), PostgreSQL, Redis
- **Frontend:** SvelteKit, TypeScript, Tailwind CSS, pnpm
- **Infrastructure:** Docker, Docker Compose, Nginx

---

## Prerequisites

### For Docker-based development (recommended)

- **Docker** (24+)
- **Docker Compose** (v2+)
- **Git**
- **`curl`** and **OpenSSL** (for SSL cert generation if needed)
- 8 GB+ RAM allocated to Docker

### For native development (without Docker)

- **Ruby 3.4+** (see `.ruby-version`)
- **Node.js 18+** and **pnpm 10.15.1+**
- **PostgreSQL 17** running locally
- **Redis** running locally
- **Bundler** and **rake**

---

## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone https://github.com/idah-ai/idah.git
cd idah
```

### 2. Start the databases

```bash
docker compose -f docker-compose-db.yml up -d
```

This starts:
- **PostgreSQL 17** on port `5432`
- **Redis** on port `6379`

### 3. Start IDAH services

```bash
docker compose up -d --build
```

This builds and starts all services:
- `nginx` (reverse proxy, port 8080/8443)
- `iam` (Identity & Access Management)
- `dataset` (Dataset management)
- `media` (Media processing)
- `sync` (Data sync/export)
- `notification` (Notifications)
- `audit` (Audit logging)
- `setting` (Settings)
- `frontend` (SvelteKit dev server on port 5173)
- `mails` (MailHog for email testing, ports 1025/8025)

### 4. Initialize the setup (first time only)

```bash
docker compose exec iam bundle exec rake dev:setup dev:users
```

This seeds the IAM service with:
- Default service accounts
- Default admin user

### 5. Access the application

Open your browser: **[https://idah.localhost:8443](https://idah.localhost:8443)**

> You'll need to accept the self-signed SSL certificate warning.

**Default Admin Credentials:**
| Field    | Value            |
|----------|------------------|
| Email    | `admin@idah.ai`  |
| Password | `P@ssword01`     |

### 6. Verify everything is working

```bash
# Check all services are running
docker compose ps

# Check the health endpoint
curl -k https://idah.localhost:8443/health
```

---

## Running Individual Services

You can start/stop individual services:

```bash
# Restart a single service
docker compose restart iam

# View logs for a specific service
docker compose logs -f frontend

# Run a one-off command in a service
docker compose run --rm iam bundle exec rake db:migrate

# Rebuild and restart a single service after code changes
docker compose up -d --build iam
```

The backend services use **hot-reload via volume mounts** — code changes inside `app/<service>/` are reflected immediately (the dev-entrypoint.sh runs `bundle` and `rake db:setup db:migrate` on each start).

The frontend dev server also hot-reloads via Vite.

### Services and their ports

| Service       | Internal Port | Exposed via Nginx                  |
|---------------|---------------|------------------------------------|
| `iam`         | 3000          | `https://idah.localhost:8443/api/v1/iam` |
| `dataset`     | 3000          | `https://idah.localhost:8443/api/v1/dataset` |
| `media`       | 3000          | `https://idah.localhost:8443/api/v1/media` |
| `sync`        | 3000          | `https://idah.localhost:8443/api/v1/sync` |
| `notification`| 3000          | `https://idah.localhost:8443/api/v1/notification` |
| `audit`       | 3000          | `https://idah.localhost:8443/api/v1/audit` |
| `setting`     | 3000          | `https://idah.localhost:8443/api/v1/setting` |
| `frontend`    | 5173          | `https://idah.localhost:8443/` (all other routes) |
| `mails`       | 8025          | `https://idah.localhost:8443/mails/` |

---

## Database Management

### Initialize / Reset all databases

The project provides two utility scripts:

```bash
# Reset ALL services (drop + create + migrate)
./bin/reset

# Reset a single service
./bin/reset dataset
```

Using Docker directly:

```bash
# Migrate all services
./bin/dev migrate

# Reset all services
./bin/dev reset
```

### Run migrations for a specific service

```bash
docker compose run --rm iam bundle exec rake db:migrate

# Rollback to a specific version
docker compose run --rm iam bundle exec rake "db:migrate[12345]"
```

### Create a new migration

```bash
# Inside a service container
docker compose run --rm dataset bundle exec sequel -m db/migrations -M 0
# Then create your migration file manually:
# db/migrations/20240101000000_add_some_column.rb
```

Migrations live in `app/<service>/db/migrations/` and use Sequel's migration DSL.

### Prepare test databases

```bash
docker compose run --rm iam bundle exec rake db:test:prepare
```

This sets `APP_ENVIRONMENT=test`, resets the test database, and runs migrations.

### Database connection details (development)

| Variable              | Default value          |
|-----------------------|------------------------|
| `DATABASE_URI`        | `postgres://postgres:postgres@postgres:5432/<service>_dev` |
| `REDIS_STREAM_URL`    | `redis://redis:6379/0` |
| `POSTGRES_CREDENTIALS` | `postgres:postgres`   |

---

## Testing

### Backend (Ruby / RSpec)

Each backend service has its own test suite using RSpec.

```bash
# Run all tests for a specific service
docker compose run --rm iam bundle exec rspec

# Run a specific test file
docker compose run --rm iam bundle exec rspec app/spec/accounts_spec.rb

# Run with verbose logging
docker compose run --rm iam LOG_LEVEL=debug bundle exec rspec

# Run with coverage report
docker compose run --rm -e CI=true iam bundle exec rspec

# Run Rubocop linter
docker compose run --rm iam bundle exec rubocop
```

**Test configuration:**
- RSpec config: `app/<service>/.rspec` (format: documentation, colored output)
- Spec helper: `app/<service>/app/spec_helper.rb`
- Common specs: `common/spec/` (shared tests loaded by each service)
- Test env file: `app/<service>/.env.test`
- Test database is auto-configured via `APP_ENVIRONMENT=test`

**Coverage:** SimpleCov generates HTML reports in `<service>/coverage/`.

### Frontend (SvelteKit / Vitest)

```bash
# Run unit tests
docker compose run --rm frontend pnpm run test:unit

# Or from within the container
docker compose exec frontend pnpm exec vitest run

# Run in watch mode
docker compose exec frontend pnpm exec vitest

# Run linter
docker compose run --rm frontend pnpm run lint

# Run type checking
docker compose run --rm frontend pnpm run check
```

**Test configuration:**
- Vitest config: `app/frontend/vite.config.ts`
- Test setup: `app/frontend/vitest-setup-client.ts`
- Frontend tests live alongside components using `*.test.ts` or `*.spec.ts` patterns

### Running CI checks locally

The CI pipeline (`.github/workflows/ci.yml`) runs the following for each service:

1. **Format check** (Ruby: Rubocop, JS/TS: Prettier + ESLint)
2. **Database setup** (`bundle exec rake db:test:prepare`)
3. **Run RSpec** (`LOG_LEVEL=error bundle exec rspec --fail-fast`)
4. **Code coverage** (SimpleCov)

To simulate CI locally for the IAM service:

```bash
docker compose run --rm \
  -e APP_ENVIRONMENT=test \
  -e POSTGRES_CREDENTIALS=postgres:postgres \
  -e CI=true \
  iam bash -c "\
    bundle exec rubocop && \
    bundle exec rake db:test:prepare && \
    LOG_LEVEL=error bundle exec rspec --fail-fast && \
    echo 'CI checks passed!'"
```

---

## Working on Backend Services

### Service structure

Each backend service follows this structure:

```
app/<service>/
├── app/
│   ├── expo/           # HTTP endpoint expositions (routes/handlers)
│   ├── model/          # Sequel models
│   ├── service/        # Business logic services
│   ├── util/           # Utility classes
│   ├── spec_data/      # Test fixtures and data
│   └── spec_helper.rb  # RSpec helper
├── common/             # Symlinked shared code
├── config/
│   ├── boot.rb         # Application boot (Dotenv, Bundler, Zeitwerk)
│   ├── config.yml      # Main config (plugins, DB, Redis, logging)
│   ├── config.development.yml
│   ├── config.test.yml
│   ├── puma.rb         # Puma web server config
│   └── routes.rb       # Expo route registrations
├── db/
│   └── migrations/     # Sequel migrations
├── .env.development    # Development environment variables
├── .env.test           # Test environment variables
├── Gemfile
├── Rakefile
├── Dockerfile
└── dev-entrypoint.sh   # Dev entrypoint (runs bundle + db setup)
```

### Adding a new migration

```bash
# Create a migration file
touch app/dataset/db/migrations/20240101000000_add_quality_score.rb

# Edit it with Sequel DSL
# Sequel.migration do
#   change do
#     add_column :entries, :quality_score, :float, default: 0.0
#   end
# end

# Run it
docker compose run --rm dataset bundle exec rake db:migrate
```

### Running a console

```bash
docker compose run --rm iam bundle exec rake console
```

This boots the Verse framework and drops into a Pry session with all models and services loaded.

### Using `bin/dev` and `bin/reset`

The helper scripts run commands across all services:

```bash
# Show available commands
./bin/dev

# Migrate all services
./bin/dev migrate

# Reset and migrate all services
./bin/dev reset

# Reset a single service
./bin/reset dataset

# Reset all services
./bin/reset
```

### Updating shared Verse gems

```bash
# Clone/update all Verse gems from GitHub
./common/gems/update_all.sh

# The gems are at common/gems/ and are referenced via Gemfile paths or GitHub branches
```

### Running a command on all services

```bash
# Run any command in all backend services
./bin/all_services "bundle exec rake db:migrate"
```

### Running native (without Docker)

If you prefer to run a service natively:

```bash
# 1. Set environment
export APP_ENVIRONMENT=development
export DATABASE_URI=postgres://postgres:postgres@localhost:5432/iam_dev
export REDIS_STREAM_URL=redis://localhost:6379/0
export IDAH_SERVICE_ACCOUNT=iam-service
export IDAH_SERVICE_PASSWORD=dev-password

# 2. Install dependencies
cd app/iam
bundle install

# 3. Setup and migrate database
bundle exec rake db:setup db:migrate

# 4. Start the server
bundle exec puma
```

---

## Working on the Frontend

### Structure

```
app/frontend/
├── src/
│   ├── lib/
│   │   ├── components/   # Svelte components
│   │   ├── utils/        # Utility functions
│   │   └── ...           # Other modules
│   ├── routes/           # SvelteKit route pages
│   └── app.html          # HTML template
├── static/               # Static assets
├── build/plugins/        # Symlinked plugins directory
├── package.json
├── svelte.config.js
└── vite.config.ts
```

### Development

The frontend is served via the Nginx reverse proxy, so you access it at `https://idah.localhost:8443/`. Vite's dev server (inside Docker) provides hot-reload.

```bash
# View frontend logs
docker compose logs -f frontend

# Access the SvelteKit dev server directly (if needed)
# The dev server runs on port 5173 inside the container
```

### Frontend-only development workflow

```bash
# Install dependencies
cd app/frontend
pnpm install

# Start the dev server directly (point to a running backend)
VITE_IDAH_HOST=https://idah.localhost:8443 pnpm run dev
```

### Running frontend tests

```bash
# Run vitest tests
pnpm run test:unit
pnpm run test:unit -- --run  # Single run

# Run end-to-end (if configured)
# pnpm run test:e2e
```

### Frontend linting and formatting

```bash
pnpm run lint        # ESLint + Prettier check
pnpm run format      # Auto-format with Prettier
pnpm run check       # Svelte type checking (svelte-check)
```

---

## Plugin Development

The plugin system allows creating custom annotation tools, media processors, and export formats.

### Plugin CLI

```bash
# Install plugin dev dependencies
cd plugins_dev
npm install

# Create a new plugin
npm run create-plugin my-plugin
# or use the CLI directly:
npx idah-plugin create my-plugin
```

### Plugin project structure

A plugin typically spans backend (Ruby) and frontend (Svelte) parts:

```
plugins_dev/
├── _cli/                  # CLI tool source
├── _template/             # Plugin template
└── (your plugin)/         # Created plugin
```

For production plugins, place them in `plugins/` instead of `plugins_dev/`.

### Plugin activation

- Backend plugins are auto-loaded from `app/<service>/plugins/` and `plugins/`
- Frontend plugins are symlinked into `app/frontend/build/plugins/` via the dev entrypoint

---

## Environment Variables

### Core variables (used by all services)

| Variable                    | Description                          | Default           |
|-----------------------------|--------------------------------------|-------------------|
| `APP_ENVIRONMENT`           | Runtime environment                  | `development`     |
| `DATABASE_URI`              | PostgreSQL connection string         | *(per service)*   |
| `REDIS_STREAM_URL`          | Redis connection URL                 | `redis://redis:6379/0` |
| `LOG_LEVEL`                 | Logging level                        | `info`            |
| `LOG_SHOW_ERROR_DETAILS`    | Show detailed error messages in HTTP | `true`            |
| `PORT`                      | HTTP server port                     | `3000`            |
| `PUMA_WORKERS`              | Puma worker count                    | `1`               |
| `PUMA_THREADS`              | Puma threads per worker              | `16`              |

### IAM-specific variables

| Variable                   | Description                          |
|----------------------------|--------------------------------------|
| `IDAH_SERVICE_ACCOUNT`     | Service account name for auth        |
| `IDAH_SERVICE_PASSWORD`    | Service account password             |

### Frontend variables

| Variable              | Description                          | Default                               |
|-----------------------|--------------------------------------|---------------------------------------|
| `VITE_IDAH_HOST`      | Backend API host (used in dev mode)  | `https://idah.localhost:8443`         |

---

## Common Troubleshooting

### 1. Docker containers fail to start

```bash
# Check logs for the failing service
docker compose logs <service>

# Rebuild from scratch
docker compose build --no-cache <service>
docker compose up -d <service>
```

### 2. Database connection errors

```bash
# Ensure databases are running
docker compose -f docker-compose-db.yml ps

# Reset a specific service database
./bin/reset <service>

# Or manually:
docker compose run --rm iam bundle exec rake db:reset db:migrate
```

### 3. SSL certificate issues

The dev environment uses self-signed certificates in `dev/nginx/ssl/`. If missing:

```bash
mkdir -p dev/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout dev/nginx/ssl/key.pem \
  -out dev/nginx/ssl/cert.pem \
  -subj "/CN=idah.localhost" \
  -addext "subjectAltName=DNS:idah.localhost,DNS:localhost"
```

### 4. Port conflicts

If ports 5432 or 6379 are already in use:

```bash
# Change PostgreSQL port in docker-compose-db.yml
# Then update DATABASE_URI in .env.docker
```

### 5. Reset everything (clean slate)

```bash
# Stop everything and remove volumes
docker compose down -v
docker compose -f docker-compose-db.yml down -v

# Start fresh
docker compose -f docker-compose-db.yml up -d
docker compose up -d --build
docker compose exec iam bundle exec rake dev:setup dev:users
```

### 6. Viewing emails in development

Access MailHog at: [https://idah.localhost:8443/mails/](https://idah.localhost:8443/mails/)

Emails sent by the `notification` service are captured here.

### 7. Slow Docker builds

- Use Docker BuildKit: `DOCKER_BUILDKIT=1 docker compose build`
- Cache is persisted in named volumes (e.g., `iam_bundler_cache`, `node_modules`)
- To clear caches: `docker compose down -v` (also removes databases)

---

## Additional Resources

- **README.md** - Project overview and quick start
- **CONTRIBUTING.md** - Contribution guidelines and PR workflow
- **SECURITY.md** - Security best practices
- **[docs.idah.ai](https://docs.idah.ai)** - Full documentation
- **[Plugin Development Guide](https://docs.idah.ai/plugin/)** - Creating plugins
- **[API Reference](https://docs.idah.ai/apis/)** - Complete API documentation
