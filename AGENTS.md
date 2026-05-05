# IDAH - AGENTS.md

This document provides a comprehensive guide to the IDAH (Ingedata Annotation Hub) codebase architecture, patterns, and conventions. It is designed to help AI agents understand the system for refactoring tasks.

---

## 1. Project Overview

**IDAH** is an open-source platform for collaborative data annotation. It follows a **microservices architecture** built with the **Verse Ruby Framework** (backend) and **SvelteKit 5** (frontend).

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend Framework** | Verse (custom Ruby framework — `verse-core`, `verse-http`, `verse-sequel`, `verse-jsonapi`, `verse-redis`, `verse-shrine`) |
| **Frontend** | SvelteKit 5, TypeScript, Tailwind CSS 4, bits-ui (shadcn-svelte) |
| **Database** | PostgreSQL 17, Redis |
| **Server** | Puma 6 |
| **Auth** | JWT (EC P-256), + service accounts, BCrypt password hashing |
| **Storage** | S3-compatible (Shrine) — filesystem in dev/test |
| **Plugin System** | Custom plugin system with JSON manifests, asset serving |
| **Containers** | Docker, Docker Compose |

### Architecture Diagram (Conceptual)

```
Nginx (reverse proxy)
├── Frontend (SvelteKit)     — port 5173 / 3000 (prod)
├── IAM Service              — port 3000
├── Dataset Service          — port 3000
├── Media Service            — port 3000
├── Sync Service             — port 3000
├── Audit Service            — port 3000
├── Notification Service     — port 3000
├── Setting Service          — port 3000
└── MailHog (dev emails)     — ports 1025, 8025

Databases:
├── PostgreSQL (all services share or have separate DBs)
└── Redis (event pub/sub, KV store, locks, counters)
```

### Workflow Overview

1. **User** authenticates via IAM service → JWT token issued
2. **User** manages projects, datasets, entries via Dataset service
3. **Media files** uploaded via Media service → processing jobs scheduled
4. **Entries** contain annotations created through the annotation plugin workspace (frontend, JSON-RPC)
5. **Exports** generated via Sync service (UPD format via `updcli-static`)
6. **Audit** service logs all resource events across the system
7. **Notification** service listens for events and sends emails
8. **Setting** service manages global and per-account settings + plugins

---

## 2. Directory Structure

```
idah/
├── AGENTS.md                    ← THIS FILE
├── docker-compose.yml           ← Main composition (all services)
├── docker-compose-db.yml        ← PostgreSQL + Redis only
├── README.md                    ← Main README
├── Rakefile                     ← Loads rake tasks from dev/tasks/
│
├── app/                         ← Microservice applications
│   ├── frontend/                ← SvelteKit web UI
│   ├── iam/                     ← Identity & Access Management
│   ├── dataset/                 ← Dataset management
│   ├── media/                   ← Media processing
│   ├── sync/                    ← Export generation
│   ├── audit/                   ← Audit logging
│   ├── notification/            ← Email notifications
│   └── setting/                 ← Settings & plugin management
│
├── common/                      ← Shared library (used by all Ruby services)
│   ├── lib/                     ← Shared Ruby modules
│   │   ├── api.rb               ← Inter-service API client
│   │   ├── api/                 ← API client internals
│   │   │   ├── exposition.rb    ← HTTP wrapper
│   │   │   ├── service.rb       ← Service abstraction
│   │   │   ├── multipart_stream.rb
│   │   │   └── __map__/         ← Endpoint definitions per service
│   │   ├── resource/            ← Resource type constants (iam, dataset, media, etc.)
│   │   ├── expo/                ← Shared exposition utilities
│   │   │   └── util/duplicate_field_helper.rb
│   │   ├── service/notification.rb  ← Pub/sub notification helper
│   │   ├── migration/timestamps.rb ← PostgreSQL timestamp helpers
│   │   ├── plugin_system/       ← Plugin loading & registry
│   │   ├── role_backend.rb      ← Auth context backend
│   │   ├── role_record.rb       ← Role model
│   │   ├── role_repository.rb   ← In-memory role storage (YAML-loaded)
│   │   ├── healthcheck_service.rb   ← Dependency health check
│   │   ├── healthcheck_expo.rb  ← Healthcheck HTTP endpoint
│   │   ├── semantic_version.rb  ← SemVer parser
│   │   ├── thread_pool.rb       ← Configurable thread pool
│   │   └── uuid_v7.rb           ← UUID v7 generator
│   ├── data/roles/              ← YAML role definitions
│   ├── gems/                    ← Scripts for gem maintenance
│   ├── bin/check-coverage       ← Coverage checking script
│   ├── rake/                    ← Shared Rake tasks
│   └── spec/                    ← Tests for common lib
│
├── plugins/                     ← Production plugins (e.g., idah-video)
├── plugins_dev/                 ← Plugin development tooling (npm-based)
├── dev/                         ← Dev configuration
│   ├── nginx/                   ← Nginx config + SSL certs
│   └── tasks/                   ← Rake tasks (loaded by root Rakefile)
├── bin/                         ← Shell scripts
├── staging/                     ← Staging deployment configs
├── updcli/                      ← UPD CLI tool distribution
├── doc/                         ← Documentation system
└── .github/                     ← CI/CD workflows
```

---

## 3. Common Library (`common/`)

The `common/` directory is a shared library mounted into every Ruby microservice container at `/app/common`. It provides:

### 3.1 Resource Constants (`common/lib/resource/`)

Defines JSON:API resource type strings used across the system:

```ruby
Resource::Iam::Accounts          # "iam:accounts"
Resource::Iam::AccountSessions   # "iam:account_sessions"
Resource::Iam::AccountAuths      # "iam:account_auths"
Resource::Iam::Organizations     # "iam:organizations"
Resource::Iam::ApiKeys           # "iam:api_keys"
Resource::Dataset::Projects      # "dataset:projects"
Resource::Dataset::ProjectMembers # "dataset:project_members"
Resource::Dataset::Datasets      # "dataset:datasets"
Resource::Dataset::Entries       # "dataset:entries"
Resource::Dataset::Annotations   # "dataset:annotations"
Resource::Dataset::NoteFeeds     # "dataset:note_feeds"
Resource::Dataset::NoteComments  # "dataset:note_comments"
Resource::Media::Jobs            # "media:jobs"
Resource::Media::Medias          # "media:medias"
Resource::Setting::Settings      # "setting:settings"
Resource::Setting::AccountSettings # "setting:account_settings"
Resource::Setting::Plugins       # "setting:plugins"
Resource::Audit::Logs            # "audit:logs"
Resource::Sync::Jobs             # "sync:jobs"
Resource::Sync::Exports          # "sync:exports"
```

### 3.2 Inter-Service API Client (`common/lib/api.rb`)

A custom HTTP client for Ruby services to call each other. It:
- Discovers services via `Api[:service_name]`
- Supports bearer token auth with auto-refresh (JWT)
- Provides `get`, `post`, `put`, `patch`, `delete` HTTP methods
- Handles JSON:API serialization/deserialization via `Verse::JsonApi::Deserializer`
- Supports multipart file uploads
- Pagination helper: `Api.all(params, &block)` for iterating over all pages

**Usage:**
```ruby
# In API map (common/lib/api/__map__/iam.rb):
Api[:idah].register(:iam, :accounts, :index) do |params = {}|
  output = get("iam/accounts", params:, options: { auth: :bearer })
  deserialize output.body
end

# In service code:
output = Api[:idah].iam.accounts.index(filter: { email: "test@example.com" })
```

### 3.3 Plugin System (`common/lib/plugin_system/`)

A registry-based plugin system:
- **Manifest**: `manifest.json` with name, description, version, modality, assets
- **Registry**: plugin discovery from filesystem paths (configurable via `IDAH_PLUGIN_PATH`)
- **Plugin**: loaded from manifest, provides assets, entry files
- **Exposition**: registers HTTP endpoints for serving plugin assets
- **Lifecycle**: Each service can define a `PluginLifecycleContext` to handle mount/unmount

### 3.4 Roles & Authorization

Roles are defined in `common/data/roles/` as YAML files with version-prefixed filenames:

| File | Role | Assignable |
|------|------|-----------|
| `0.0.0_anonymous.yml` | `anonymous` | No |
| `1.0.0_user.yml` | `user` | Yes |
| `2.0.0_org_owner.yml` | `org_owner` | Yes |
| `8.0.0_admin.yml` | `admin` | Yes |
| `9.9.9_system.yml` | `system` | No |
| `api_scopes/*.yml` | `api/*` | No |

**Role loading**: `RoleRepository` loads YAML, supports `$template` references in rights, and compound roles (e.g., `api/org_rw_all`). `RoleBackend` integrates with Verse auth context.

---

## 4. Microservice Architecture (Ruby / Verse)

Each Ruby service follows a consistent structure:

```
app/<service>/
├── Dockerfile
├── Gemfile + Gemfile.lock
├── config.ru                     ← Rack entry point
├── config/
│   ├── boot.rb                   ← Bootstrap (dotenv, zeitwerk, routes, initializers)
│   ├── routes.rb                 ← Register expositions & event listeners
│   ├── puma.rb                   ← Puma configuration
│   ├── config.yml                ← Base config
│   ├── config.development.yml    ← Dev overrides
│   └── config.test.yml           ← Test overrides
├── config/initializers/          ← Initializers loaded at boot
│   ├── cookies.rb                ← Sinatra::Cookies
│   ├── load_roles.rb             ← Load roles & set RoleBackend
│   ├── set_keys.rb               ← Load JWT signing key
│   ├── scheduler.rb              ← (media/sync) Start job scheduler
│   ├── plugin_system.rb          ← (media/sync/setting) Init plugin system
│   ├── mailer.rb                 ← (notification) SMTP config
│   ├── shrine.rb                 ← (media/sync) Shrine storage config
│   └── default_export_formats.rb ← (sync) Register default export formats
├── db/migrations/                ← Sequel migrations (timestamped)
├── app/
│   ├── spec_helper.rb            ← RSpec config
│   ├── expo/                     ← Exposition layer (HTTP endpoints + event handlers)
│   │   ├── base_expo.rb          ← Shared base class (JSON:API renderer)
│   │   └── *.rb                  ← Specific expositions
│   ├── model/                    ← Verse model records + repositories
│   │   └── *.rb                  ← Record/Repository pairs
│   ├── service/                  ← Business logic layer
│   │   └── *.rb / subdirectories ← Service classes
│   ├── util/                     ← Utility classes
│   │   └── *.rb
│   └── spec_data/                ← Test fixtures
└── dev-entrypoint.sh             ← Dev container entry point
```

### 4.1 Service Layer Patterns

Each service follows Verse's layered architecture:

```
HTTP Request → Exposition (expo/) → Service (service/) → Repository (model/) → Database
Event        → Exposition (expo/) → Service (service/) → Repository (model/) → Database
```

- **Exposition**: Defines HTTP endpoints (`on_http`) and event handlers (`on_resource_event`). Inherits from `BaseExpo` which sets `Verse::JsonApi::Renderer`.
- **Service**: Business logic, validation, authorization. Extends `Verse::Service::Base`. Uses repositories for data access.
- **Model/Record**: Data mapping with `Verse::Model::Record::Base`. Defines fields, associations, primary keys.
- **Repository**: Data access with `Verse::Model::Sequel::Repository` or `Verse::Model::InMemory::Repository`. Implements query scoping, filters, custom queries.
- **Resources**: Resource type constants for inter-service event publishing.

### 4.2 Authorization / Scoping

Each repository implements `scoped(action)` with a DSL:

```ruby
repository_class.scoped(action) do |scope|
  scope.all?       # No filtering
  scope.as_org_owner? { |org_id| ... }  # Filter by organization
  scope.as_user? { |account_id| ... }   # Filter by account
end
```

The `RoleBackend` (in common) evaluates role rights against the auth context. Frontend implements a matching `AuthContext.can()` method.

### 4.3 Event System

Services communicate asynchronously via Redis pub/sub (Verse Event Manager):
- Events are published on resource CRUD (e.g., `iam:accounts:created`)
- Services listen via `on_resource_event(resource, action)` in expositions
- The Audit service subscribes to nearly all resource events for logging
- The Notification service listens for `service:notification:send_email` events
- The sync/media services listen for job lifecycle events

### 4.4 Shared Dependencies (per service Gemfile)

All services share these core Verse gems (from GitHub, `master` branch):
- `verse-core`
- `verse-http` (branch `features/migrate-to-sinatra-4`)
- `verse-jsonapi`
- `verse-redis`
- `verse-sequel`
- `verse-schema` (~> 1.2.4)

Additional per-service gems:
- `verse-jsonrpc` — dataset (annotations RPC), iam, sync, notification, audit
- `verse-shrine` — media, sync, setting
- `verse-periodic` — iam, media, setting
- `aasm` — dataset, sync (state machine workflow)
- `bcrypt` — iam (password hashing)
- `mail` — notification (email sending)
- `rmagick` — media, setting (image processing)
- `rubyzip`, `builder` — sync (export generation)

---

## 5. Service-by-Service Reference

### 5.1 IAM Service (`app/iam/`)

**Purpose**: Identity & Access Management — accounts, organizations, roles, authentication, API keys.

**Models**:
- `Account::Record` — users (id, name, email, hashed_password, role_name, role_scope, enabled, joined_at, etc.)
- `AccountSession::Record` — login sessions (id, account_id, refresh_seq, nonce, ip, user_agent)
- `Organization::Record` — organizations (id, name)
- `ApiKey::Record` — API keys (id, account_id, key_sha, permissions, scope_type, scope_value, status, expires_at)
- `AccountAuth::Record` — pseudo-record for login/refresh output (role_rights, auth_token, refresh_token)

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/accounts` | CRUD + `join`, `resend_invitation` |
| `/account_sessions` | Index, delete |
| `/organizations` | CRUD |
| `/api_keys` | CRUD + `revoke`, `permissions`, scheduled `expire_api_keys` |
| `/auth` | `login`, `logout`, `refresh` |
| `/auth/api` | `login` (API key auth) |
| `/account/passwords` | `request_reset`, `reset`, `token_valid`, `change` |
| `/healthcheck` | Health check |

**Key Services**:
- `Auth::Service` — login/refresh/logout logic, JWT management
- `Account::Service` — CRUD + invitation flow + `RoleChangeNotification`
- `AccountPassword::Service` — password reset flow
- `ApiKey::Service` — API key management + permission listing
- `AccountSession::Service` — session management
- `Organization::Service` — org CRUD

**DB Migrations**:
- `20250714000000_create_initial_schema` — accounts, organizations, account_sessions
- `20260114000000_add_invitation_token_to_accounts`
- `20260313000000_create_api_keys_table`

### 5.2 Dataset Service (`app/dataset/`)

**Purpose**: Manage projects, datasets, entries, annotations, note feeds/comments, workflows.

**Models**:
- `Project::Record` — projects (id, name, description, organization_id, created_by_email)
- `Dataset::Record` — datasets (id, project_id, name, labels, modality, labeling_configuration, workflow_configuration, status, progress, counters)
- `Entry::Record` — entries (id, project_id, dataset_id, resource, name, priority, wf_step, status, job_id, assigned_to_id, submitted_by_id, reviewed_by_id)
- `Annotation::Record` — annotations (id, entry_id, dimensions, annotation, metadata, created_by_email)
- `NoteFeed::Record` — discussion threads (id, entry_id, annotation_id, anchor_type, position, status, content_md)
- `NoteComment::Record` — comments (id, note_feed_id, content_md, created_by_email)
- `ProjectMember::Record` — members (id, project_id, account_id, name, email, role, invited_by_id, disabled_at)

**Workflow**: `SimpleReviewAnnotationWorkflow` (AASM state machine):
```
start → annotate → review → done
                  ↘         ↗
                  error → error
```
Events: `submit`, `error`

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/projects` | CRUD |
| `/project_members` | CRUD + event handlers for account updates |
| `/datasets` | CRUD + event handler for dataset completion |
| `/entries` | CRUD + `assign`, `select`, `submit`, `error` |
| `/annotations` | CRUD + JSON-RPC (`_rpc` batch endpoint) |
| `/note_feeds` | CRUD + `resolve` |
| `/note_comments` | CRUD |
| `/healthcheck` | Health check |

**DB Migrations**: 5 migrations — initial schema, triggers (annotation→entry→dataset→project cascade), disabled_at, metadata, filename.

**Key Patterns**:
- Database triggers auto-update dataset counters (total/completed/in_progress) on entry changes
- Cascade timestamps via triggers: annotations→entries→datasets→projects
- Entry assignments via `assigned_to_id`, `submitted_by_id`, `reviewed_by_id`
- Soft-delete `ProjectMember` via `disabled_at`
- JSON-RPC batching for annotation CRUD (batch limit: 50)

### 5.3 Media Service (`app/media/`)

**Purpose**: Media file storage, processing job scheduling, video processing.

**Models**:
- `Medias::Record` — media files (id, resource, key, filename, size, mime_type, created_by, created_role, public, meta, project_id) — file stored in Shrine (S3/filesystem)
- `Jobs::Record` — processing jobs (id, job_class, arguments, priority, status, progress, retry_count, unicity, error, scheduled_at)

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/medias` | Index, info, upload, download |
| `/jobs` | Index, show, delete |
| Event | `dataset:entries:created` → triggers processor |

**Key Services**:
- `Medias::Service` — upload/download/list media with Shrine storage
- `Jobs::Service` — CRUD for processing jobs
- `Jobs::Scheduler` — singleton (`SCHEDULER`) — polls for pending jobs, runs in thread pool
- `Jobs::Base` — abstract job base class with progress/error/reschedule
- `Processor::Service` — triggered on entry creation, routes to registered processors per modality
- `Processor::Registry` — modal → processor class mapping (populated by plugins)
- `Processor::Job` — wraps processor execution in job
- `Processor::Context` — provides download/upload/media management to processors
- `Executor` — runs shell commands (e.g., FFmpeg) via thread pool
- `Video::Service` — video processing job creation

**DB Migrations**: 1 migration — `medias` table + `jobs` table + UUID v7/v8 functions.

### 5.4 Sync Service (`app/sync/`)

**Purpose**: Dataset export generation & job scheduling.

**Models**:
- `Jobs::Record` — export jobs (id, job_class, arguments, priority, status, progress, etc.)
- `Exports::Record` — generated exports (id, job_id, project_id, created_by_id, file_id, filename, mime_type, size)

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/exports` | Index, show, download, export (POST), formats (GET) |
| `/jobs` | Index, show, delete |

**Key Services**:
- `Exports::Service` — create/upload exports
- `Exports::Registry` — export format registration (modality → exporter class)
- `Exports::Context` + `DatasetContext` + `EntryContext` + `AnnotationContext` + `MediaContext` + `IoContext` — export data context objects
- `Exports::Job` (extends `Jobs::Base`) — runs export job
- `Exports::Upd::Exporter` — UPD format exporter using `updcli-static` binary
- `Jobs::Scheduler` + `Jobs::Service` + `Jobs::Base` — same pattern as Media service
- `Executor` — shell command executor
- `PluginLifecycleContext` — export format registration from plugins

**DB Migrations**: 1 migration — `jobs` table + `exports` table.

### 5.5 Audit Service (`app/audit/`)

**Purpose**: Comprehensive event logging for all resource operations.

**Models**:
- `Log::Record` — audit log entries (id, actor_account_id, actor_account_email, actor_account_role_name, action, resource_service, resource_type, resource_id, organization_id, project_id, dataset_id, entry_id, event_timestamp)

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/logs` | Index, show |
| Events | Subscribes to ALL resource events: iam (accounts, sessions, organizations), dataset (projects, members, datasets, entries), media (medias) |

**Key Services**:
- `Log::Service` — create/query log entries

**DB Migrations**: 1 migration — `logs` table with composite indexes on (entity, event_timestamp) pairs.

### 5.6 Notification Service (`app/notification/`)

**Purpose**: Email notification delivery.

**Models**: None (no database tables).

**Endpoints**: None HTTP — purely event-driven.

**Key Services**:
- `Email::Service` — receive `service:notification:send_email` events, lookup account, check notification preferences, build & deliver email
- `Email::Renderer` — ERB template rendering (HTML + text templates in `app/service/email/templates/`)

**Templates**:
- `account_created` — invitation email
- `password_reset` — password reset email
- `project_member_added` / `project_member_removed`
- `org_owner_role_assigned` / `org_owner_role_removed`
- `dataset_completed`
- Partials: header, footer

**Config**: SMTP settings in initializer (login auth for production, plain for dev).

### 5.7 Setting Service (`app/setting/`)

**Purpose**: Global settings, per-account settings, plugin management & asset serving.

**Models**:
- `Setting::Record` — global settings (id, key, value)
- `AccountSetting::Record` — per-account settings (id, account_id, key, plugin, value)
- `Plugin::Record` — plugin registrations (id, source_type, source_path, name, description, version)

**Endpoints**:
| Prefix | Endpoints |
|--------|-----------|
| `/account_settings` | Index, show, update |
| `/plugins` | `modalities`, `show_modality`, `serve_asset`, `serve` (entry files) |
| `/settings` | Index, show, update |
| Events | `iam:accounts:created` → create defaults; `iam:accounts:deleted` → cleanup |

**Key Services**:
- `AccountSettings::Service` — CRUD for account settings; defaults: `{"notification:organization:activities" => true, "notification:project:activities" => true}`
- `Settings::Service` — global settings CRUD
- `Plugins::Service` — plugin info, asset serving, modality/shape queries
- `Plugins::Manager` — async plugin operations queue

**DB Migrations**: 1 migration — `settings`, `account_settings`, `plugins` tables.

### 5.8 Frontend (`app/frontend/`)

**Purpose**: SvelteKit 5 web application.

**Tech**: Svelte 5 (runes: `$state`, `$derived`), TypeScript, Tailwind CSS 4, bits-ui/shadcn-svelte, Vite.

**Route Structure**:
```
/ → redirects to /projects
/login
/forgot-password
/reset-password
/accept-invitation
/error
/accounts                    (admin)
/audit-logs
/organizations
/organizations/[id]/projects
/organizations/[id]/owners
/projects
/projects/[id]/datasets
/projects/[id]/datasets/[id]/analytics
/projects/[id]/datasets/[id]/entries
/projects/[id]/datasets/[id]/labels
/projects/[id]/exports
/projects/[id]/members
/settings/appearance
/settings/notifications
/settings/security
/entries/[entryId]/plugin/[pluginId]   (annotation workspace)
```

**Data Layer** (`src/lib/data/`):
- `BackendDataSource` — main HTTP client for JSON:API, with `list`, `get`, `create`, `update`, `delete`
- `Record` — base class with `@type`, `@field`, `@relationship` decorators; `RecordFactory` for deserialization
- `MemoryDataSource` — in-memory implementation for testing
- `Cache` — in-memory cache (3-min TTL, cleared on writes)
- `jsonrpc.ts` — JSON-RPC batch client (batches up to 200 calls within 5s)
- Domain-specific data sources for each entity

**State Management**:
- `AuthContext` — singleton with `authStatus` writable store
- `refetches` store — triggers data reloads via `{#key}` blocks
- `CommandManager` — undo/redo stack for annotation tools (max 100 commands, 5s combine window)

**Plugin System** (`src/lib/plugin/`):
- `IdahPlugin.svelte` — hosts external plugins via `window.idah_plugin` global
- `AnnotationDriver` — bridges annotation CRUD via JSON-RPC
- `NoteDriver` — notes/comments management
- `IconDriver` — icon loading
- `ActivityContext` — context passed to plugins (entry, media, project info)

---

## 6. Key Patterns & Conventions

### 6.1 Code Organization per Service

Each service follows this pattern:
```
app/
├── expo/         ← Expositions (controllers)
│   ├── base_expo.rb
│   └── entity_expo.rb
├── model/        ← Records & Repositories
│   └── entity.rb   ← Contains both Record and Repository classes
├── service/      ← Business logic
│   └── entity/
│       └── service.rb
├── util/         ← Utilities
└── spec_data/    ← Test fixtures
config/
├── boot.rb       ← Bootstrap
├── routes.rb     ← Route/event registration
├── puma.rb       ← Server config
├── config.yml    ← Base config + environment overrides
└── initializers/ ← Loaded at boot
db/migrations/    ← Sequel migrations
```

### 6.2 Naming Conventions

- **Files**: snake_case for Ruby files (`accounts_expo.rb`), kebab-case for frontend components
- **Classes**: PascalCase (`AccountsExpo`, `Account::Service`, `Project::Record`)
- **Resource types**: colon-separated, e.g., `"iam:accounts"`, `"dataset:entries"`
- **Events**: `"resource_type:action"`, e.g., `"iam:accounts:created"`
- **Services**: `Entity::Service`, `Entity::Repository`, `Entity::Record`
- **Expositions**: `EntityPluralExpo` (e.g., `AccountsExpo`, `DatasetsExpo`)

### 6.3 Database Migration Style

```ruby
Sequel.migration do
  up do
    # Enable extensions if needed
    # Create tables
    # Add triggers
  end
  down do
    # Reversible
  end
end
```

Migration filenames use timestamp convention: `YYYYMMDDHHMMSS_description.rb`.

### 6.4 JSON:API Conventions

- Requests: `Content-Type: application/vnd.api+json`
- Responses: JSON:API format with `data`, `included`, `meta`, `errors`
- Filters via query params: `filter[field__op]=value`
- Pagination via `page[number]` and `page[size]`
- Sparse fieldsets via `fields[type]=field1,field2`
- Includes via `include=relationship1,relationship2`

### 6.5 Code Patterns to Maintain

1. **Service Layer Isolation**: Services should NOT directly use repositories unless via `use RepositoryName`
2. **Expositions as Thin Layer**: Expositions should only handle HTTP/event plumbing; business logic goes in services
3. **Auth Scoping in Repositories**: Row-level security is implemented in repository `scoped` blocks
4. **Event Publishing**: Done by repositories on state changes; expositions subscribe
5. **Zeitwerk Autoloading**: All files in `app/` and `common/lib/` are auto-loaded; follow directory-based naming

### 6.6 Frontend Conventions

- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `#snippet`)
- Tailwind CSS 4 (new `@import "tailwindcss"` syntax)
- shadcn-svelte / bits-ui for UI components
- `BackendDataSource` for HTTP, `Record` subclasses for domain models
- `AuthContext` singleton for auth state
- `PageProvider` wrapper for authorization checks
- `DatasourceTable` component for all list views
- Refetch pattern via `refetches` store + `{#key}` blocks

---

## 7. Inter-Service Communication

### 7.1 Event-Driven (Redis Pub/Sub)

Services communicate asynchronously through Verse's Event Manager (Redis-backed in production, local in test).

**Publishing pattern** (in repositories):
```ruby
# Repository publishes events on state changes
create(attributes) do |record|
  publish_event("created", record)
end
```

**Subscription pattern** (in expositions):
```ruby
expose on_resource_event(Resource::Iam::Accounts, "created")
def on_account_created
  service.create_account_settings(message.content[:resource_id])
end
```

### 7.2 HTTP API Calls (Internal)

Services call each other via the `Api` client defined in `common/lib/api.rb`, using service accounts with JWT bearer tokens.

**Registration** in `common/lib/api/__map__/`:
```ruby
Api[:idah].register(:iam, :accounts, :show) do |id:|
  output = get("iam/accounts/:id", params: { id: }, options: { auth: :bearer })
  deserialize output.body
end
```

**Usage**:
```ruby
result = Api[:idah].iam.accounts.show(id: 123)
```

### 7.3 Service Accounts

Each service uses a service account to authenticate for inter-service HTTP calls. Credentials are configured via `IDAH_SERVICE_ACCOUNT` and `IDAH_SERVICE_PASSWORD` environment variables.

---

## 8. Plugin System

### 8.1 Structure

Plugins are directories with a `manifest.json`:
```json
{
  "name": "idah-video",
  "description": "Video annotation support",
  "version": "0.1.0",
  "modality": "idah-video",
  "assets": ["frontend/dist"],
  "entry": {
    "js": "frontend/dist/plugin.js",
    "css": "frontend/dist/plugin.css"
  }
}
```

### 8.2 Plugin Registration

- **Setting service**: Scans `IDAH_PLUGIN_PATH` (glob pattern, defaults to `plugins/**`) for manifests
- **Media service**: Plugin registers processors for modalities via `Processor::Registry`
- **Sync service**: Plugin registers export formats via `Exports::Registry`
- **Frontend**: Plugin JS loads at `/entries/[id]/plugin/[pluginId]` and renders via `IdahPlugin.svelte`

### 8.3 Plugin Lifecycle

Each service with plugin support defines a `PluginLifecycleContext`:
- `mount_plugin(plugin_name)` — setup
- `unmount_plugin` — cleanup (clear registry entries for the plugin)
- Service-specific registration methods (e.g., `register_exports`, `register_processors`)

---

## 9. Testing

### 9.1 Pattern

- RSpec for Ruby services
- `spec_helper.rb` loads app environment, `APP_ENVIRONMENT=test`
- `spec_data/` directory for test fixtures
- WebMock for HTTP stubbing
- RackTest for HTTP endpoint testing
- SimpleCov for coverage (`common/bin/check-coverage`)

### 9.2 Test Configuration Override

In `config.test.yml`, event manager uses `local` adapter (no Redis dependency) and log level is `debug`.

---

## 10. Configuration & Environment Variables

### 10.1 Shared Across Services

| Variable | Purpose |
|----------|---------|
| `IDAH_URL` | Base URL for inter-service API calls |
| `IDAH_SERVICE_ACCOUNT` | Service account email |
| `IDAH_SERVICE_PASSWORD` | Service account password |
| `SERVICE_JWT_KEY` | EC P-256 private key (PEM content or `file:/path`) |
| `DATABASE_URI` | PostgreSQL connection string |
| `REDIS_STREAM_URL` | Redis connection string |
| `LOG_LEVEL` | Logging level (info/debug) |
| `LOG_SHOW_ERROR_DETAILS` | Show detailed errors in HTTP responses |
| `PUMA_WORKERS` | Puma worker count |
| `PUMA_THREADS` | Puma thread count |
| `PORT` | HTTP port (default: 3000) |
| `IDAH_PLUGIN_PATH` | Glob for plugin discovery (default: `plugins/**`) |
| `IDAH_JOBS_CONCURRENCY` | Job processing concurrency (media/sync) |
| `GC_COMPACT_CRON_RULE` | Cron schedule for GC compaction |

### 10.2 Service-Specific

| Service | Variable | Purpose |
|---------|----------|---------|
| iam | `IDAH_AUTH_COOKIE_NAME` | Auth cookie name |
| iam | `IDAH_AUTH_TOKEN_EXP` | Token expiration (seconds) |
| iam | `IDAH_REFRESH_TOKEN_EXP` | Refresh token expiration (seconds) |
| media | `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 storage config |
| media | `IDAH_FFMPEG_PATH`, `IDAH_FFPROBE_PATH` | FFmpeg paths |
| media | `IDAH_DECODING_THREADS`, `IDAH_ENCODING_THREADS` | Video processing threads |
| notification | `SMTP_*` variables | SMTP server settings |
| frontend | `VITE_IDAH_HOST` | Backend API base URL |

---

## 11. Refactoring Guidelines

### 11.1 Before Refactoring

1. **Understand the domain**: Read the service's README.md, DATA.md, and explore the service/module structure
2. **Map dependencies**: Check Gemfile, config/initializers/, and routes.rb for plugin/event dependencies
3. **Check common lib usage**: Services use common/ — changes there affect all services
4. **Understand the data flow**: Trace HTTP request → exposition → service → repository → DB or event flow
5. **Check scoping**: Every repository implements auth scoping — do not bypass it

### 11.2 Code Quality Standards

- **RuboCop**: Each service has `.rubocop.yml` and `.rubocop-https---relaxed-ruby-style-rubocop-yml`
- **Tests**: RSpec with SimpleCov coverage — maintain or improve coverage
- **No Rails**: The Verse framework is NOT Rails; do not use Rails conventions or APIs
- **Autoloading**: Zeitwerk is used — file paths must match module/class naming
- **JSON:API compliance**: All HTTP APIs should follow JSON:API spec

### 11.3 Common Pitfalls

- **Zeitwerk naming**: A file `accounts_expo.rb` defines `AccountsExpo`; `service/account/service.rb` defines `Account::Service`
- **Resource constants**: Use `Resource::Service::Entity` constants, NOT hardcoded strings
- **Event channels**: Use `Resource::Service::Entity` for resource events, custom channels for others
- **Sequel vs ActiveRecord**: Sequel is used — different API (e.g., `Sequel.lit()`, `DB.execute()`, migration DSL)
- **Thread safety**: Scheduler, thread pool, and Redis connections need careful synchronization

### 11.4 Refactoring Priorities (Typical)

1. **Consolidate duplicated code** — e.g., Jobs system is duplicated between media and sync services
2. **Extract shared logic to common/** — e.g., scheduler, thread pool, job base class
3. **Remove dead code** — check for unused API maps, unused endpoints, commented code
4. **Standardize patterns** — ensure all services follow the same exposition/service/repository pattern
5. **Improve testing** — add integration tests for inter-service communication
6. **Documentation** — ensure DATA.md files are accurate, add inline comments for complex logic

---

## 12. Quick Reference

### 12.1 Creating a New Endpoint

1. Create exposition file in `app/expo/entity_expo.rb`
2. Define class `EntityExpo < BaseExpo` with `http_path "/entities"`
3. Add `expose on_http(:get, "")` methods
4. Create service in `app/service/entity/service.rb`
5. Use `use EntityRepository` in service
6. Define model in `app/model/entity.rb` (Record + Repository)
7. Register in `config/routes.rb`
8. Add migration in `db/migrations/`
9. Add API map in `common/lib/api/__map__/service.rb` (if inter-service calls needed)

### 12.2 Adding a New Event

**Publisher** (in repository):
```ruby
after_create do |record|
  event_manager.publish("my:event:channel", resource_id: record.id)
end
```

**Subscriber** (in exposition):
```ruby
expose on_resource_event("my:event:channel", "action")
def handler_method
  # message.content[:resource_id]
end
```

### 12.3 Adding a New Plugin

1. Create directory with `manifest.json`
2. Add plugin entry files (JS/CSS)
3. For media: implement processor class, register in `Processor::Registry`
4. For sync: implement exporter class, register in `Exports::Registry`
5. For frontend: export `IActivityView` on `window.idah_plugin`
6. Frontend loads at `/entries/[id]/plugin/[pluginId]`

---

*This document is maintained for AI agent guidance. Update it when significant architectural changes are made.*