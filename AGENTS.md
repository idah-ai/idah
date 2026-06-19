# IDAH - AGENTS.md

This document outlines the **project patterns and conventions** agents must follow when working on the IDAH (Ingedata Annotation Hub) codebase. Detailed domain explanations live in `guide/` — read the relevant guide for the service you're modifying.

---

## Quick Links to Domain Guides

| Domain | Guide |
|--------|-------|
| **Verse Layered Architecture** | [`guide/verse-architecture.md`](guide/verse-architecture.md) |
| **Exposition Layer (HTTP + Events)** | [`guide/exposition-layer.md`](guide/exposition-layer.md) |
| **Service Layer (Business Logic)** | [`guide/service-layer.md`](guide/service-layer.md) |
| **Model & Repository (Data Access)** | [`guide/model-repository.md`](guide/model-repository.md) |
| **Auth & Authorization** | [`guide/auth-authorization.md`](guide/auth-authorization.md) |
| **Event System** | [`guide/event-system.md`](guide/event-system.md) |
| **Inter-Service API Client** | [`guide/inter-service-api.md`](guide/inter-service-api.md) |
| **Plugin System** | [`guide/plugin-system.md`](guide/plugin-system.md) |
| **Job System (Media/Sync)** | [`guide/job-system.md`](guide/job-system.md) |
| **IAM Service** | [`guide/service-iam.md`](guide/service-iam.md) |
| **Dataset Service** | [`guide/service-dataset.md`](guide/service-dataset.md) |
| **Media Service** | [`guide/service-media.md`](guide/service-media.md) |
| **Sync Service** | [`guide/service-sync.md`](guide/service-sync.md) |
| **Audit Service** | [`guide/service-audit.md`](guide/service-audit.md) |
| **Notification Service** | [`guide/service-notification.md`](guide/service-notification.md) |
| **Setting Service** | [`guide/service-setting.md`](guide/service-setting.md) |
| **Frontend (SvelteKit)** | [`guide/frontend.md`](guide/frontend.md) |
| **Database Migrations** | [`guide/database-migrations.md`](guide/database-migrations.md) |
| **Testing** | [`guide/testing.md`](guide/testing.md) |
| **Configuration & Environment** | [`guide/configuration.md`](guide/configuration.md) |

---

## Golden Rules

1. **Layered isolation**: Exposition → Service → Repository → DB. Never call repositories from expositions. Never put business logic in expositions.
2. **Auth scoping in repositories**: Every repository must implement `scoped(action)`. Never bypass it — use `use_system_repo` only when unavoidable (e.g., workflow transitions that reassign entries away from the current user).
3. **Events from repositories**: Publish resource events in repositories using the `event(name:)` decorator or `with_metadata` blocks. Expositions subscribe.
4. **Resource constants**: Use `Resource::Service::Entity` constants, never hardcoded strings. They serve double duty: JSON:API type identifiers and event channel names.
5. **Zeitwerk naming**: File paths must match module/class names. `accounts_expo.rb` → `AccountsExpo`. `model/account.rb` → `module Account; class Record; end; class Repository; end; end`.
6. **No Rails**: Verse is not Rails. Use Sequel DSL (`Sequel.lit()`, `DB.execute()`, migration syntax), not ActiveRecord.
7. **JSON:API compliance**: All HTTP APIs must use `Content-Type: application/vnd.api+json`. Responses follow JSON:API format.
8. **JSON-RPC for annotations**: Annotation mutations use batch JSON-RPC at `/annotations/_rpc` (batch limit: 50). Standard CRUD is also available.
9. **Thread safety**: Scheduler, thread pool, and Redis connections need `MonitorMixin` synchronization.
10. **No hardcoded UUIDs**: Use `UUIDv7.generate` for UUIDs, not `SecureRandom.uuid`.

---

## Recommended Workflow

Follow this sequence for every task to ensure thoroughness and quality:

1. **Plan first** — Before writing any code, outline your approach. Include caveats, risks, and concerns (e.g., migration backwards-compatibility, auth scoping edge cases, or breaking changes to existing APIs).

2. **Read the guide** — Open the relevant domain guide from the table above for the service or layer you're modifying. Understand the patterns and conventions before you begin.

3. **Check existing specs** — For backend code, read the existing specs related to the area you're modifying. Understand the current test coverage before making changes.

4. **Write specs** — Write RSpec tests for the new behavior *before* implementing it. This ensures the implementation is testable and the requirements are clear.

5. **Implement** — Write the implementation code, making sure all specs pass.

6. **Frontend unit tests** — For frontend changes, write unit tests only for non-component utility classes, methods, or pure logic. Components (Svelte files) typically do not require unit tests unless they contain complex non-rendering logic.

---

## Architecture at a Glance

```
Nginx (reverse proxy)
├── Frontend (SvelteKit)     — port 5173 / 3000 (prod)
├── IAM Service              — port 3000  (auth, accounts, orgs, API keys)
├── Dataset Service          — port 3000  (projects, datasets, entries, annotations)
├── Media Service            — port 3000  (file storage, processing jobs)
├── Sync Service             — port 3000  (export generation)
├── Audit Service            — port 3000  (event logging)
├── Notification Service     — port 3000  (email delivery)
├── Setting Service          — port 3000  (settings, plugins)
└── MailHog (dev emails)     — ports 1025, 8025
```

Services communicate via **Redis pub/sub** (events) or **HTTP** (internal API client via `common/lib/api.rb`).

---

## Code Organization per Service

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
│   └── config.{env}.yml          ← Environment overrides
├── config/initializers/          ← Loaded at boot
├── db/migrations/                ← Sequel migrations
├── app/
│   ├── spec_helper.rb            ← RSpec + SimpleCov config
│   ├── expo/                     ← Exposition layer (controllers + event handlers)
│   │   ├── base_expo.rb          ← Sets JSON:API renderer
│   │   └── *.rb                  ← Per-entity expositions
│   ├── model/                    ← Records + Repositories (same file, same module)
│   │   └── entity.rb
│   ├── service/                  ← Business logic
│   │   └── entity/service.rb
│   ├── util/                     ← Utilities
│   └── spec_data/                ← Test fixtures
└── dev-entrypoint.sh
```

---

## Shared Library (`common/`)

Mounted at `/app/common` in every Ruby service container. Key modules:

| Module | Purpose |
|--------|---------|
| `lib/resource/` | JSON:API resource type constants & event channel names |
| `lib/api.rb` + `lib/api/` | Inter-service HTTP client with JWT bearer auth |
| `lib/plugin_system/` | Plugin discovery, loading, lifecycle |
| `lib/role_backend.rb` | Auth context role rights evaluation |
| `lib/role_repository.rb` | In-memory role storage (YAML-loaded) |
| `lib/role_record.rb` | Role model |
| `lib/thread_pool.rb` | Configurable worker pool |
| `lib/uuid_v7.rb` | RFC 9562 UUID v7 generator |
| `lib/healthcheck_service.rb` | Dependency health checks |
| `lib/service/notification.rb` | Email notification pub helper |
| `data/roles/` | YAML role definitions (version-prefixed) |

---

## Refactoring Guidelines

### Before Refactoring

1. **Understand the domain**: Read the relevant guide(s) in `guide/` first.
2. **Map dependencies**: Check Gemfile, `config/initializers/`, and `config/routes.rb` for plugin/event dependencies.
3. **Check common/ usage**: Changes to `common/` affect all services.
4. **Trace the data flow**: HTTP → exposition → service → repository → DB (or event path).
5. **Check scoping**: Every repository implements auth scoping — do not bypass it.

### Common Pitfalls

- **Zeitwerk naming**: `accounts_expo.rb` defines `AccountsExpo`; `service/account/service.rb` defines `Account::Service`.
- **Resource constants**: Use `Resource::Service::Entity`, NOT hardcoded strings. See [`guide/auth-authorization.md`](guide/auth-authorization.md).
- **Event channels**: Use `Resource::Service::Entity` for resource events, custom channels for everything else.
- **Sequel vs ActiveRecord**: Use `Sequel.lit()`, `DB.execute()`, and Sequel migration DSL.
- **Thread safety**: `MonitorMixin` for scheduler and thread pool synchronization.

---

*This file is a navigation index. For implementation details, open the relevant guide in `guide/`.*
