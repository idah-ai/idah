# Verse Layered Architecture

## Overview

IDAH (Ingedata Annotation Hub) is built on the **Verse Ruby Framework**, which enforces a strict **4-layer architecture** with unidirectional dependencies:

```
Exposition → Service → Repository → Database
```

Each layer has a single responsibility and communicates only with the layer directly below it. This isolation ensures testability, security, and maintainability across all services (IAM, Dataset, Media, Sync, Audit, Notification, Setting).

### Data Flow: HTTP Request

```
HTTP Request
  → BaseExpo parses JSON:API request body & params
    → Exposition validates input via DSL (types, required fields)
      → Service (business logic, orchestration, validation)
        → Repository (auth-scoped query, event publishing)
          → Sequel → PostgreSQL
            → Response bubbles back up through the layers
```

### Data Flow: Event

```
Redis pub/sub message
  → Exposition event handler (on_resource_event / on_event)
    → Service (business logic)
      → Repository (data access, scope)
        → DB
```

---

## Layer Responsibilities

---

### 1. Exposition Layer

**Location:** `app/{service}/app/expo/`

The exposition layer is the **entry point** for all external interactions. It handles both **HTTP routing** and **event subscriptions**, performing validation and delegation — never business logic.

#### HTTP Exposition

Expositions extend `BaseExpo` (which extends `Verse::Exposition::Base`) and declare a root path with `http_path`:

```ruby
# app/iam/app/expo/base_expo.rb
require "verse/json_api"

class BaseExpo < Verse::Exposition::Base
  def self.inherited(klass)
    super
    klass.renderer Verse::JsonApi::Renderer  # All expositions use JSON:API
  end
end
```

```ruby
# app/iam/app/expo/organizations_expo.rb
class OrganizationsExpo < BaseExpo
  http_path "/organizations"

  use_service Organization::Service

  desc <<~MD
    Manage organizations within the system, including creation,
    updating, retrieval, and deletion.
  MD

  json_api Organization::Record do
    index do
      allowed_filters :name__match,
                      :created_at__gte,
                      :created_at__lte
    end

    show
    create
    update
    delete
  end
end
```

**Key points:**
- `json_api RecordClass do ... end` auto-generates CRUD endpoints (index, show, create, update, delete)
- `allowed_filters` / `blacklist_filters` control which query parameters are accepted
- `allowed_included` controls which relationships can be sideloaded (e.g. `allowed_included "account"`)
- `use_service` injects the service layer — exposition never calls repositories directly

#### Custom HTTP Endpoints

Non-CRUD actions use `expose on_http(method, path)` with explicit input validation:

```ruby
# app/iam/app/expo/accounts_expo.rb
class AccountsExpo < BaseExpo
  http_path "/accounts"

  use_service Account::Service

  expose on_http(:patch, "/:token/join", auth: nil) do
    desc "Mark account as joined when user accepts invitation"
    input do
      field :token, String
    end
  end
  def join
    account, password_reset_token = service.mark_as_joined(params[:token])
    renderer.meta = {
      password_reset_token: password_reset_token
    }

    account
  end
end
```

Notable: `auth: nil` disables auth for this endpoint. The `input` block validates `params` before the method is called. Access params via `params[:token]`.

#### Event Exposition

Expositions also subscribe to events using `on_resource_event` or `on_event`:

```ruby
# app/iam/app/expo/accounts_expo.rb
expose on_resource_event(Resource::Iam::Organizations, "deleted")
def on_organization_deleted
  organization_id = message.content[:resource_id]
  service.remove_org_from_account_role_scope(organization_id)
end
```

- `on_resource_event(resource_constant, event_name)` subscribes to resource lifecycle events (e.g. "created", "updated", "deleted")
- `on_event(channel_name)` subscribes to custom events
- The `message` object provides `message.content` (a hash with `:resource_id` and any custom metadata)
- The exposition delegates immediately to the service — no business logic here

#### Registration

All expositions are registered in `config/routes.rb`:

```ruby
# app/iam/config/routes.rb
Verse.on_boot do
  [
    HealthcheckExpo,
    OrganizationsExpo,
    AccountsExpo,
    AccountSessionsExpo,
    Auth::SimpleExpo,
    Account::PasswordsExpo,
    ApiKeysExpo,
    Auth::ApiExpo,
  ].each(&:register)
end
```

---

### 2. Service Layer

**Location:** `app/{service}/app/service/{entity}/service.rb`

The service layer contains **business logic, validation, and orchestration**. It extends `Verse::Service::Base` and uses dependency injection via `use` and `use_system`.

```ruby
# app/iam/app/service/organization/service.rb
module Organization
  class Service < Verse::Service::Base
    use organizations: Organization::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      organizations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      organizations.find!(id, included: included)
    end

    def create(record)
      organizations.transaction do
        record_id = organizations.create(record.attributes)
        organizations.find!(record_id)
      end
    end
  end
end
```

#### Repository Injection

Repositories are injected as named accessors:

```ruby
use organizations: Organization::Repository
# Provides `organizations` as a scoped repository instance
```

Multiple repositories can be injected:

```ruby
use accounts: Account::Repository,
    organization_service: Organization::Service,    # Other services can also be injected
    role_change_notification: Account::RoleChangeNotification
```

#### System Repositories (`use_system`)

When a service needs to **bypass auth scoping** (e.g., workflow transitions that reassign entries away from the current user, or checking for duplicate accounts), use `use_system`:

```ruby
use_system accounts_system: Account::Repository
# Provides `accounts_system` — a repository with scoping bypassed
```

This is used sparingly — only when the current user's scope would prevent legitimate operations. See [Auth & Authorization](auth-authorization.md) for details.

#### Cross-Service Calls

Services can call other services via the internal API client:

```ruby
def delete(id)
  projects = Api[:idah].dataset.projects.index(
    filter: { organization_id: id }
  ).data
  raise Verse::Error::Unauthorized, "Unable to delete organization that still has project(s)" unless projects.empty?

  organizations.delete!(id)
end
```

`Api[:idah].dataset` returns a client for the Dataset service, enabling inter-service communication over HTTP with JWT bearer auth.

#### Transactions

Transactions span across repositories:

```ruby
accounts.transaction do
  # Multiple repository operations
  id = accounts.create(attr)
  created_account = accounts_system.find!(id)
  # ... after_commit hooks
end
```

`after_commit` blocks run after the transaction completes:

```ruby
accounts.transaction do
  accounts.update!(record.id, record.attributes)

  accounts.after_commit do
    role_change_notification.deliver!(previous_account:, updated_account:)
  end
end
```

---

### 3. Model / Record Layer

**Location:** `app/{service}/app/model/{entity}.rb`

The Record class extends `Verse::Model::Record::Base` and declares the schema, resource type, and associations.

```ruby
# app/dataset/app/model/project.rb (Record section)
module Project
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Projects

    field :id, type: String, primary: true

    field :name, type: String
    field :description, type: [String, NilClass]
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    field :organization_id, type: Integer, readonly: true

    has_many :project_members, repository: "ProjectMember::Repository", foreign_key: :project_id
    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :project_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :project_id
    has_many :note_feeds, repository: "NoteFeed::Repository", foreign_key: :project_id
  end
end
```

#### Field Declarations

| Option      | Description                                      |
|-------------|--------------------------------------------------|
| `type`      | Ruby type (String, Integer, Time, Hash, etc.)   |
| `readonly`  | Field cannot be set via create/update            |
| `visible`   | `false` hides field from JSON:API responses      |
| `primary`   | Marks the primary key field                      |
| `default`   | Default value if not provided                    |

#### Resource Types

The `type` declaration uses a **resource constant** from `common/lib/resource/`:

```ruby
# common/lib/resource/iam.rb
module Resource
  module Iam
    Accounts = "iam:accounts"
    Organizations = "iam:organizations"
    ApiKeys = "iam:api_keys"
  end
end

# common/lib/resource/dataset.rb
module Resource
  module Dataset
    Projects = "dataset:projects"
    Entries = "dataset:entries"
    Annotations = "dataset:annotations"
    NoteFeeds = "dataset:note_feeds"
    NoteComments = "dataset:note_comments"
    EntryStats = "dataset:entry_stats"
  end
end
```

These constants serve **double duty**:
1. JSON:API resource type identifiers
2. Event channel names for resource lifecycle events

**Never hardcode strings** — always use these constants.

#### Associations

- `belongs_to :name, repository: "Repo::Class", foreign_key: :column` — adds a parent reference
- `has_many :name, repository: "Repo::Class", foreign_key: :column` — adds a child collection
- Both support `primary_key` to specify the local key (defaults to `:id`)

---

### 4. Repository Layer

**Location:** Same file as Record, under the same module.

The Repository extends `Verse::Sequel::Repository` and handles **data access, auth scoping, event publishing, and custom query filters**.

```ruby
# app/dataset/app/model/project.rb (Repository section)
module Project
  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          project_id = auth_context.custom_scopes[:project]

          if org_ids
            table.where(organization_id: org_ids)
          elsif project_id
            table.where(id: project_id)
          else
            table.where(Sequel.lit("false"))
          end
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end
  end
end
```

#### Auth Scoping (`scoped`)

**Every repository must implement `scoped(action)`.** This method is the security backbone. It uses `auth_context.can!(action, resource)` to check permissions, then applies row-level filtering based on the role:

- `scope.all? { table }` — admin/system roles see everything
- `scope.as_org_owner? { ... }` — org-level filtering
- `scope.as_user? { ... }` — user-level filtering (project membership, assignments)
- `scope.own { table.where(id: auth_context.metadata[:id]) }` — own resources only (e.g. accounts)

The `action` parameter is a symbol like `:read`, `:create`, `:update`, `:delete`, or custom actions like `:login`, `:join`, `:submit`.

#### Custom Filters

Extend the JSON:API query DSL with `custom_filter`:

```ruby
custom_filter :role_name__nin do |collection, role_name|
  collection.where(Sequel.lit("role_name NOT IN ?", role_name))
end

custom_filter :with_role_scope do |collection, role_scope|
  role_scope = role_scope.to_json unless role_scope.is_a?(String)
  collection.where(Sequel.lit("role_scope @> ?", role_scope))
end

custom_filter :participated do |collection, value|
  collection.where(Sequel.lit(<<~SQL, account_id: value))
    assigned_to_id = :account_id
    OR submitted_by_id = :account_id
    OR reviewed_by_id = :account_id
  SQL
end

custom_filter :assigned do |collection, value|
  assigned = value.to_s.downcase == "true"
  if assigned
    collection.where(Sequel.lit("assigned_to_id IS NOT NULL"))
  else
    collection.where(Sequel.lit("assigned_to_id IS NULL"))
  end
end
```

Filters declared in the repository are available as HTTP query parameters (e.g. `?filter[assigned]=true`) when also listed in `allowed_filters` in the exposition.

#### Event Publishing

Repositories publish events using the `event(name:)` decorator:

```ruby
event(name: "selected")
def select(id)
  no_event do
    transaction do
      update!(id, { assigned_to_id: auth_context.metadata[:id] }, scope: scoped(:read))
    end
  end
end

event(name: "assigned")
def assign(id, attributes)
  entry = find!(id)

  add_event_metadata(
    project_id: attributes[:project_id] || entry.project_id,
    dataset_id: attributes[:dataset_id] || entry.dataset_id,
    entry_id: id
  )

  no_event do
    transaction do
      update!(id, attributes)
    end
  end
end
```

- `event(name:)` decorates the method to publish an event after execution
- `no_event { }` suppresses event publishing within a block (useful when you want to publish a custom event instead)
- Standard CRUD methods (`create`, `update!`, `delete!`) publish events automatically via their resource type

#### Event Metadata (`with_metadata` / `add_metadata`)

Enrich event payloads with contextual data:

```ruby
def create(attributes)
  with_metadata do
    add_event_metadata

    super(attributes)
  end
end

def update!(id, attributes, scope: scoped(:update))
  with_metadata do
    project = find!(id)

    add_event_metadata(
      organization_id: attributes[:organization_id] || project.organization_id,
      project_id: id
    )

    super(id, attributes, scope:)
  end
end

def delete!(id)
  with_metadata do
    find!(id)
    add_event_metadata(organization_id: id)
    super(id)
  end
end
```

The helper method pattern:

```ruby
private

def add_event_metadata(**opts)
  add_metadata(
    actor_account_id: auth_context.metadata[:id],
    actor_account_email: auth_context.metadata[:email],
    actor_account_role_name: auth_context.metadata[:role],
    **opts
  )
end
```

#### Encoders

For JSONB columns, use `encoder` to auto-serialize/deserialize:

```ruby
# app/dataset/app/model/annotation.rb
class Repository < Verse::Sequel::Repository
  self.table = "annotations"
  self.resource = Resource::Dataset::Annotations

  encoder :dimensions, Verse::Sequel::JsonEncoder
  encoder :annotation, Verse::Sequel::JsonEncoder
  encoder :metadata, Verse::Sequel::JsonEncoder
end
```

This ensures `Hash` fields are automatically JSON-serialized when writing to the database and deserialized when reading.

#### Raw SQL & Special Operations

For operations requiring raw SQL (e.g. atomic sequence checks):

```ruby
def check_seq(account_id, session_id, nonce, sequence)
  with_db_mode :rw do |_db|
    new_sequence = sequence + 30
    updated = table
              .with_sql(<<~SQL, account_id:, session_id:, nonce:, refresh_seq: new_sequence)
                UPDATE account_sessions
                SET refresh_seq = :refresh_seq
                WHERE account_id = :account_id
                  AND id = :session_id
                  AND nonce = :nonce
                  AND refresh_seq < :refresh_seq
                RETURNING id
              SQL
              .first

    !!updated
  end
end
```

- `with_db_mode :rw` ensures read-write connection
- `Sequel.lit(...)` is the Verse/Sequel way to write raw SQL

---

## Project Structure

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
│   ├── expo/                     ← Exposition layer
│   │   ├── base_expo.rb          ← Base class, sets JSON:API renderer
│   │   └── {entity}_expo.rb      ← Per-entity expositions
│   ├── model/                    ← Records + Repositories (same file, same module)
│   │   └── {entity}.rb
│   ├── service/                  ← Business logic
│   │   └── {entity}/
│   │       └── service.rb
│   ├── util/                     ← Utilities
│   └── spec_data/                ← Test fixtures
└── dev-entrypoint.sh
```

### File Naming Convention

Zeitwerk autoloading requires file paths to match module/class names:

| File Path                                | Module/Class              |
|------------------------------------------|---------------------------|
| `app/expo/accounts_expo.rb`              | `AccountsExpo`            |
| `app/expo/account/passwords_expo.rb`     | `Account::PasswordsExpo`  |
| `app/model/account.rb`                   | `Account::Record` + `Account::Repository` |
| `app/model/project.rb`                   | `Project::Record` + `Project::Repository` |
| `app/service/account/service.rb`         | `Account::Service`        |
| `app/service/organization/service.rb`    | `Organization::Service`   |

---

## Key Conventions

1. **Layered isolation**: Exposition → Service → Repository → DB. Never call repositories from expositions. Never put business logic in expositions.

2. **Auth scoping in every repository**: The `scoped(action)` method is mandatory. It uses `auth_context.can!` with role-based `scope.all?`, `scope.as_org_owner?`, `scope.as_user?`, and `scope.own` blocks.

3. **`use_system_repo` sparingly**: Only when unavoidable (e.g., workflow transitions that reassign entries, cross-org admin operations). Standard operations must use the scoped repository.

4. **Events from repositories, subscriptions in expositions**: Repositories publish events via the `event(name:)` decorator or `with_metadata` blocks. Expositions subscribe via `on_resource_event` / `on_event`. This keeps the dependency direction clear.

5. **Resource constants everywhere**: Use `Resource::Service::Entity`, never hardcoded strings. See [Auth & Authorization](auth-authorization.md) for details.

6. **Zeitwerk file naming**: File paths must match module/class names exactly. Underscored filenames map to CamelCase class names.

7. **No ActiveRecord**: Use Sequel DSL — `Sequel.lit()`, `DB.execute()`, and the Sequel migration DSL. See [Database Migrations](database-migrations.md).

8. **JSON:API compliance**: All HTTP APIs use `Content-Type: application/vnd.api+json`. Responses follow JSON:API format with resource types, attributes, relationships, and included resources.

9. **Transactions span repositories**: Wrap multi-repo operations in `repo.transaction { ... }`. Use `after_commit` for side effects that should only happen on successful persistence.

10. **JSONB with encoders**: Hash fields backed by JSONB columns must use `encoder :field_name, Verse::Sequel::JsonEncoder`.

---

## Service Directory Layout (Example: IAM)

```
app/iam/
├── config/
│   └── routes.rb                     # Registers all expositions
├── db/migrations/
│   └── ...                           # Sequel migrations
└── app/
    ├── spec_helper.rb
    ├── expo/
    │   ├── base_expo.rb              # Sets JSON:API renderer
    │   ├── accounts_expo.rb          # /accounts — CRUD + custom endpoints
    │   ├── account_sessions_expo.rb  # /account_sessions — CRUD
    │   ├── account/
    │   │   └── passwords_expo.rb     # /accounts/:id/password — custom
    │   ├── auth/
    │   │   └── simple_expo.rb        # Auth endpoints
    │   ├── api_keys_expo.rb          # /api_keys — CRUD
    │   └── organizations_expo.rb     # /organizations — CRUD
    ├── model/
    │   ├── account.rb                # Account::Record + Account::Repository
    │   ├── account_session.rb        # AccountSession::Record + Repository
    │   ├── account_auth.rb           # AccountAuth::Record + Repository
    │   ├── api_key.rb                # ApiKey::Record + Repository
    │   └── organization.rb           # Organization::Record + Repository
    ├── service/
    │   ├── account/
    │   │   └── service.rb            # Account::Service
    │   ├── account_session/
    │   │   └── service.rb            # AccountSession::Service
    │   ├── auth/
    │   │   └── service.rb            # Auth::Service
    │   ├── api_key/
    │   │   └── service.rb            # ApiKey::Service
    │   └── organization/
    │       └── service.rb            # Organization::Service
    └── util/
```

---

## Common Pitfalls

| Pitfall | Correct Approach |
|---------|-----------------|
| Hardcoding `"iam:accounts"` in code | Use `Resource::Iam::Accounts` constant |
| Calling `Repo.find!` from an exposition | Delegate through the service layer |
| `SecureRandom.uuid` for IDs | Use `UUIDv7.generate` |
| ActiveRecord-style queries | Use `Sequel.lit()`, `DB.execute()`, Sequel DSL |
| Bypassing `scoped` | Use `use_system_repo` only when truly necessary |
| Business logic in expositions | Move to the service layer |
| Event subscription with raw channel string | Use `Resource::Service::Entity` constant |
| Placing Record and Repository in separate files | Keep both in the same file under the same module |

---

## Related Guides

| Guide | Description |
|-------|-------------|
| [Exposition Layer](exposition-layer.md) | HTTP routing, input validation, event handlers |
| [Service Layer](service-layer.md) | Business logic, orchestration, cross-service calls |
| [Model & Repository](model-repository.md) | Records, repos, scoping, event publishing |
| [Auth & Authorization](auth-authorization.md) | Auth context, role scoping, resource constants |
| [Event System](event-system.md) | Event publishing, subscription, channels |
| [Database Migrations](database-migrations.md) | Sequel migration DSL, conventions |
