# Audit Service

## Overview

The Audit Service provides **immutable event logging** for all resource operations across IDAH. It subscribes to resource events published by every other service and persists them as structured log entries. This log serves as the audit trail for compliance, debugging, and user activity monitoring.

The service is **purely event-driven** — it exposes read-only HTTP endpoints for querying the log but never initiates writes via HTTP. All writes come from event subscriptions.

---

## Models

### Log::Record

Stored in the `logs` table. Each record captures a single resource event with full context about who performed the action, on what resource, and within which scope.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `actor_account_id` | `uuid` | Account UUID of the actor |
| `actor_account_email` | `text` | Email of the actor (denormalized for query speed) |
| `actor_account_role_name` | `text` | Role name of the actor at time of action |
| `action` | `text` | Action performed: `created`, `updated`, `deleted`, `logged_in`, `logged_out`, `assigned`, `unassigned`, `submitted` |
| `resource_service` | `text` | Service name that owns the resource (e.g. `iam`, `dataset`, `media`) |
| `resource_type` | `text` | Resource type (e.g. `accounts`, `projects`, `entries`, `medias`) |
| `resource_id` | `uuid` | UUID of the affected resource |
| `organization_id` | `uuid` | Organization scope (may be `nil` for system-level actions) |
| `project_id` | `uuid` | Project scope (may be `nil`) |
| `dataset_id` | `uuid` | Dataset scope (may be `nil`) |
| `entry_id` | `uuid` | Entry scope (may be `nil`) |
| `event_timestamp` | `timestamptz` | When the original event occurred |
| `created_at` | `timestamptz` | When the log entry was persisted |

All scope fields are nullable — only the relevant context for each event type is populated:

- **Organization events**: `organization_id` populated
- **Project events**: `organization_id` + `project_id` populated
- **Dataset events**: `organization_id` + `project_id` + `dataset_id` populated
- **Entry events**: All scope fields populated
- **Auth events**: Only `actor_account_id` + `organization_id` (if applicable)

```ruby
class Log::Record < Sequel::Model(:logs)
  include Verse::Model

  plugin :timestamps, update_on_create: true, only: [:created_at]
end
```

---

## Endpoints

### HTTP — `/logs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/logs` | Authenticated | List log entries (paginated, filterable) |
| `GET` | `/logs/:id` | Authenticated | Show a single log entry |

#### Filters (for `GET /logs`)

| Filter | Type | Description |
|--------|------|-------------|
| `actor_account_id` | `uuid` | Filter by actor |
| `action` | `text` | Filter by action name |
| `resource_service` | `text` | Filter by service name |
| `resource_type` | `text` | Filter by resource type |
| `resource_id` | `uuid` | Filter by resource UUID |
| `organization_id` | `uuid` | Filter by organization |
| `project_id` | `uuid` | Filter by project |
| `dataset_id` | `uuid` | Filter by dataset |
| `entry_id` | `uuid` | Filter by entry |
| `event_timestamp__gte` | `datetime` | Events on or after this timestamp |
| `event_timestamp__lte` | `datetime` | Events on or before this timestamp |

No `POST`, `PATCH`, or `DELETE` endpoints exist — the audit log is append-only via events.

---

## Events

The Audit Service subscribes to **all resource events** published by IAM, Dataset, and Media services. Each event maps to a structured log entry.

### IAM Service Events

| Event | Action Stored | Scope Fields |
|-------|---------------|--------------|
| `iam:accounts:created` | `created` | `actor_account_id`, `organization_id` |
| `iam:accounts:updated` | `updated` | `actor_account_id`, `organization_id` |
| `iam:accounts:deleted` | `deleted` | `actor_account_id`, `organization_id` |
| `iam:accounts:logged_in` | `logged_in` | `actor_account_id` |
| `iam:account_sessions:logged_out` | `logged_out` | `actor_account_id` |
| `iam:organizations:created` | `created` | `actor_account_id`, `organization_id` |
| `iam:organizations:updated` | `updated` | `actor_account_id`, `organization_id` |
| `iam:organizations:deleted` | `deleted` | `actor_account_id`, `organization_id` |

### Dataset Service Events

| Event | Action Stored | Scope Fields |
|-------|---------------|--------------|
| `dataset:projects:created` | `created` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:projects:updated` | `updated` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:projects:deleted` | `deleted` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:project_members:created` | `created` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:project_members:updated` | `updated` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:project_members:deleted` | `deleted` | `actor_account_id`, `organization_id`, `project_id` |
| `dataset:datasets:created` | `created` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id` |
| `dataset:datasets:updated` | `updated` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id` |
| `dataset:datasets:deleted` | `deleted` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id` |
| `dataset:entries:created` | `created` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |
| `dataset:entries:updated` | `updated` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |
| `dataset:entries:deleted` | `deleted` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |
| `dataset:entries:assigned` | `assigned` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |
| `dataset:entries:unassigned` | `unassigned` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |
| `dataset:entries:submitted` | `submitted` | `actor_account_id`, `organization_id`, `project_id`, `dataset_id`, `entry_id` |

### Media Service Events

| Event | Action Stored | Scope Fields |
|-------|---------------|--------------|
| `media:medias:created` | `created` | `actor_account_id`, `project_id` |
| `media:medias:updated` | `updated` | `actor_account_id`, `project_id` |
| `media:medias:deleted` | `deleted` | `actor_account_id`, `project_id` |

---

## Key Services

### Log::Service

Handles creation and querying of log entries.

```ruby
class Log::Service < Verse::Service::Base
  use_repository Log::Repository

  # List log entries with pagination and filters
  def index(pagination:, filters: {})
    repository.index(pagination:, filters:)
  end

  # Show a single log entry
  def show(id)
    repository.find!(id)
  end

  # Create a log entry (called from event handlers)
  def create_entry(actor:, action:, resource:, scope: {})
    repository.create!(
      actor_account_id: actor[:id],
      actor_account_email: actor[:email],
      actor_account_role_name: actor[:role_name],
      action: action,
      resource_service: resource[:service],
      resource_type: resource[:type],
      resource_id: resource[:id],
      organization_id: scope[:organization_id],
      project_id: scope[:project_id],
      dataset_id: scope[:dataset_id],
      entry_id: scope[:entry_id],
      event_timestamp: Time.current
    )
  end
end
```

The `create_entry` method is the single write path, called uniformly by all event handlers.

---

## Event Handler Pattern

The Audit Service defines one exposition per service domain. Each exposition uses `on_resource_event` and `on_event` declarations to subscribe. A shared convention defines a single handler method name per event family — see the note below about `%w[...].each` blocks.

### Accounts Events Handler

Multiple `%w[...].each` blocks each define a method named `on_account_event`, but each block captures the correct binding at definition time:

```ruby
class AccountsEventsExpo < BaseExpo
  # Each iteration defines a new `on_account_event` method.
  # The LAST definition wins at runtime, but each expose binding
  # captures `action` correctly at definition time.
  %w[created updated deleted logged_in].each do |action|
    expose on_resource_event(Resource::Iam::Accounts, action)
    define_method(:on_account_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "iam", type: "accounts", id: message.content[:resource_id] },
        scope: { organization_id: message.content[:organization_id] }
      )
    end
  end
end
```

### Sessions Events Handler

```ruby
class SessionsEventsExpo < BaseExpo
  %w[logged_out].each do |action|
    expose on_resource_event(Resource::Iam::AccountSessions, action)
    define_method(:on_session_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "iam", type: "account_sessions", id: message.content[:resource_id] },
        scope: {}
      )
    end
  end
end
```

### Organizations Events Handler

```ruby
class OrganizationsEventsExpo < BaseExpo
  %w[created updated deleted].each do |action|
    expose on_resource_event(Resource::Iam::Organizations, action)
    define_method(:on_organization_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "iam", type: "organizations", id: message.content[:resource_id] },
        scope: { organization_id: message.content[:resource_id] }
      )
    end
  end
end
```

### Projects Events Handler

```ruby
class ProjectsEventsExpo < BaseExpo
  %w[created updated deleted].each do |action|
    expose on_resource_event(Resource::Dataset::Projects, action)
    define_method(:on_project_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "dataset", type: "projects", id: message.content[:resource_id] },
        scope: {
          organization_id: message.content[:organization_id],
          project_id: message.content[:resource_id]
        }
      )
    end
  end
end
```

### Project Members Events Handler

```ruby
class ProjectMembersEventsExpo < BaseExpo
  %w[created updated deleted].each do |action|
    expose on_resource_event(Resource::Dataset::ProjectMembers, action)
    define_method(:on_project_member_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "dataset", type: "project_members", id: message.content[:resource_id] },
        scope: {
          organization_id: message.content[:organization_id],
          project_id: message.content[:project_id]
        }
      )
    end
  end
end
```

### Datasets Events Handler

```ruby
class DatasetsEventsExpo < BaseExpo
  %w[created updated deleted].each do |action|
    expose on_resource_event(Resource::Dataset::Datasets, action)
    define_method(:on_dataset_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "dataset", type: "datasets", id: message.content[:resource_id] },
        scope: {
          organization_id: message.content[:organization_id],
          project_id: message.content[:project_id],
          dataset_id: message.content[:resource_id]
        }
      )
    end
  end
end
```

### Entries Events Handler

```ruby
class EntriesEventsExpo < BaseExpo
  %w[created updated deleted assigned unassigned submitted].each do |action|
    expose on_resource_event(Resource::Dataset::Entries, action)
    define_method(:on_entry_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "dataset", type: "entries", id: message.content[:resource_id] },
        scope: {
          organization_id: message.content[:organization_id],
          project_id: message.content[:project_id],
          dataset_id: message.content[:dataset_id],
          entry_id: message.content[:resource_id]
        }
      )
    end
  end
end
```

### Media Events Handler

```ruby
class MediasEventsExpo < BaseExpo
  %w[created updated deleted].each do |action|
    expose on_resource_event(Resource::Media::Medias, action)
    define_method(:on_media_event) do
      service.create_entry(
        actor: message.content[:actor],
        action: action,
        resource: { service: "media", type: "medias", id: message.content[:resource_id] },
        scope: {
          project_id: message.content[:project_id]
        }
      )
    end
  end
end
```

### Important: `%w[...].each` Method Redefinition

Each `%w[...].each` block above calls `define_method(:on_account_event)` (or similar) multiple times. The **last definition wins** at runtime for each exposition class. However, each `expose on_resource_event(...)` call captures the correct `action` value at **definition time** via closure binding. This means:

- All events in the loop are correctly subscribed
- Only the **last action's handler method** is kept on the class
- But that single method dispatches correctly because `action` was captured in the closure for each separate `expose` registration

If you need to inspect which handler runs, look at the `expose` declarations — the method body is identical for all events within the same loop and only the `action` string differs.

---

## DB Migrations

```ruby
Sequel.migration do
  up do
    create_table(:logs) do
      column :id, :uuid, default: Sequel.lit("uuid_generate_v7()"), primary_key: true
      column :actor_account_id, :uuid, null: false
      String :actor_account_email, null: false
      String :actor_account_role_name, null: false
      String :action, null: false
      String :resource_service, null: false
      String :resource_type, null: false
      column :resource_id, :uuid, null: false
      column :organization_id, :uuid
      column :project_id, :uuid
      column :dataset_id, :uuid
      column :entry_id, :uuid
      DateTime :event_timestamp, null: false, default: Sequel::CURRENT_TIMESTAMP

      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :actor_account_id
      index :action
      index :resource_service
      index :resource_type
      index :resource_id
      index :organization_id
      index :project_id
      index :dataset_id
      index :entry_id
      index :event_timestamp
      # Composite index for common query patterns
      index [:organization_id, :project_id, :action]
      index [:resource_service, :resource_type, :resource_id]
    end
  end

  down do
    drop_table(:logs)
  end
end
```

The migration includes indexes on all filterable fields plus composite indexes for the most common query patterns: scoping to a project/organization and filtering by resource identity.

---

## Architecture Diagram

```
IAM Service                Dataset Service              Media Service
────────────                ──────────────              ─────────────
accounts:created ─┐        projects:created ─┐         medias:created ─┐
accounts:updated ─┤        projects:updated ─┤         medias:updated ─┤
accounts:deleted ─┤        projects:deleted ─┤         medias:deleted ─┤
accounts:logged_in ┤        project_members:* ┤                          │
sessions:logged_out┤        datasets:* ───────┤                          │
organizations:* ───┤        entries:* ────────┤                          │
                   │        assigned/unassign ┤                          │
                   │        submitted ────────┤                          │
                   ▼        ▼                 ▼                          ▼
          ┌────────────────────────────────────────────────────────────────┐
          │                    Audit Service                               │
          │                                                                │
          │  AccountsEventsExpo   ← on_resource_event (accounts, sessions) │
          │  OrganizationsEventsExpo ← on_resource_event (organizations)   │
          │  ProjectsEventsExpo   ← on_resource_event (projects)           │
          │  ProjectMembersEventsExpo ← on_resource_event (project_members)│
          │  DatasetsEventsExpo   ← on_resource_event (datasets)           │
          │  EntriesEventsExpo    ← on_resource_event (entries)            │
          │  MediasEventsExpo     ← on_resource_event (medias)             │
          │                                                                │
          │  Log::Service.create_entry → Log::Repository → logs table     │
          └────────────────────────────────────────────────────────────────┘
                               │
                          HTTP API (read-only)
                     GET /logs, GET /logs/:id
```

---

## Related Documentation

| Topic | Guide |
|-------|-------|
| Event system (publish/subscribe) | [`guide/event-system.md`](guide/event-system.md) |
| Verse layered architecture | [`guide/verse-architecture.md`](guide/verse-architecture.md) |
| Exposition layer (HTTP + events) | [`guide/exposition-layer.md`](guide/exposition-layer.md) |
| Model & repository patterns | [`guide/model-repository.md`](guide/model-repository.md) |
| Auth & authorization | [`guide/auth-authorization.md`](guide/auth-authorization.md) |
| Resource constants (`Resource::Iam::*`, `Resource::Dataset::*`) | [`guide/auth-authorization.md`](guide/auth-authorization.md) |
