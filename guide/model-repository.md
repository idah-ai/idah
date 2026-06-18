# Model & Repository (Data Access)

## Overview

In IDAH, data access follows a clear two-class pattern within a single module: **Record** (the data model / ORM row wrapper) and **Repository** (the data access object with auth-scoping, event publishing, and custom queries). Both live in `app/{service}/app/model/entity.rb` following Zeitwerk naming conventions.

This layer sits below **Service** (business logic) and above **the database** (Sequel). No exposition code calls repositories directly — that's the service layer's job.

---

## File Structure

A single file houses both the Record and Repository classes under the same module:

```
app/{service}/app/model/entity.rb
```

```ruby
# frozen_string_literal: true

module Entity
  class Record < Verse::Model::Record::Base
    # field declarations, associations, type resource, helper methods
  end

  class Repository < Verse::Sequel::Repository
    # table, resource, custom_filters, scoped, events, crud overrides, encoders
  end
end
```

**Zeitwerk rule:** the file path and module name must match. `app/iam/app/model/account.rb` defines `module Account; class Record; end; class Repository; end; end`.

---

## Record Declarations

The Record class extends `Verse::Model::Record::Base` and describes the shape of a database row for the application.

### Fields

```ruby
field :id, type: Integer, primary: true
field :name, type: String
field :email, type: String, readonly: true
field :hashed_password, type: [String, NilClass], visible: false, readonly: true
field :enabled, type: [TrueClass]
field :role_scope, type: Hash
field :created_at, type: Time, readonly: true
field :updated_at, type: Time, readonly: true
```

| Option | Purpose |
|--------|---------|
| `type:` | Single class (`String`, `Integer`, `Time`, `Hash`, `Array`, `TrueClass`) or union (`[String, NilClass]`). Determines serialization/deserialization. |
| `readonly: true` | Set only on create, never on update. Good for system-managed fields like `created_at`, `email` on signup, or `entry_id`. |
| `visible: false` | Hidden from JSON:API output. Use for secrets: `hashed_password`, `password_reset_token`, `key_sha`, `nonce`, `refresh_seq`. |
| `primary: true` | Marks the primary key. Automatically used by Repository for `find`, `update!`, `delete!`. |
| `label: "..."` | Optional human-readable label for API doc generation. |

Real-world examples from the codebase:

```ruby
# IAM Account (app/iam/app/model/account.rb)
field :id, type: Integer, primary: true
field :name, type: String
field :email, type: String, readonly: true
field :hashed_password, type: [String, NilClass], visible: false, readonly: true
field :enabled, type: [TrueClass]
field :role_name, type: [String, NilClass]
field :role_scope, type: Hash
field :created_at, type: Time, readonly: true

# Dataset Entry (app/dataset/app/model/entry.rb)
field :id, type: String, primary: true
field :project_id, type: String, readonly: true
field :dataset_id, type: String, readonly: true
field :priority, type: Integer
field :assigned_to_id, type: [Integer, NilClass]

# Media (app/media/app/model/medias.rb)
field :meta, type: Hash
field :public, type: TrueClass
field :size, type: Integer
field :mime_type, type: String
field :project_id, type: String, readonly: true

# Job (app/media/app/model/jobs.rb)
field :arguments, type: Hash
field :priority, type: Integer
field :progress, type: Float
field :retry_count, type: Integer
field :unicity, type: String
field :scheduled_at, type: Time

# Setting (app/setting/app/model/setting.rb)
field :value, type: [Hash, Array, String, Integer, Float, TrueClass, NilClass]
```

### Resource Type

Every Record declares its JSON:API resource type via `type`:

```ruby
type Resource::Dataset::Entries   # evaluates to "dataset:entries"
type Resource::Iam::Accounts      # "iam:accounts"
type Resource::Media::Medias      # "media:medias"
type Resource::Setting::Plugins   # "setting:plugins"
```

This constant serves **two purposes**:
1. **JSON:API type identifier** — used in `Content-Type: application/vnd.api+json` responses.
2. **Event channel base name** — repository events auto-publish to channels like `"dataset:entries:created"`.

**Never hardcode string literals.** Always use the `Resource::Service::Entity` constant. The constants are defined in `common/lib/resource/`:

```ruby
# common/lib/resource/iam.rb
module Resource
  module Iam
    Accounts = "iam:accounts"
    AccountSessions = "iam:account_sessions"
    AccountAuths = "iam:account_auths"
    Organizations = "iam:organizations"
    ApiKeys = "iam:api_keys"
  end
end
```

Other modules: `Resource::Dataset`, `Resource::Media`, `Resource::Audit`, `Resource::Setting`, `Resource::Sync`.

### Associations

Associations let you eager-load related records via JSON:API include syntax:

```ruby
belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
has_many :entry_stats, repository: "EntryStat::Repository", foreign_key: :entry_id
```

**Custom join keys** (when the FK references a different column than the PK):

```ruby
belongs_to :assigned_to,
           repository: "ProjectMember::Repository",
           primary_key: :account_id,
           foreign_key: :assigned_to_id
belongs_to :submitted_by,
           repository: "ProjectMember::Repository",
           primary_key: :account_id,
           foreign_key: :submitted_by_id
belongs_to :reviewed_by,
           repository: "ProjectMember::Repository",
           primary_key: :account_id,
           foreign_key: :reviewed_by_id
```

The `repository:` parameter accepts either a string (`"Entry::Repository"`) or a constant (`Entry::Repository`). Strings are preferred to avoid circular dependency issues at load time.

Real-world patterns:

```ruby
# NoteFeed (app/dataset/app/model/note_feed.rb) — multiple belongs_to + has_many
belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
belongs_to :annotation, repository: "Annotation::Repository", foreign_key: :annotation_id
has_many :note_comments, repository: "NoteComment::Repository", foreign_key: :note_feed_id

# Project — has_many for all sub-entities
has_many :project_members, repository: "ProjectMember::Repository", foreign_key: :project_id
has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
has_many :entries, repository: "Entry::Repository", foreign_key: :project_id
has_many :note_feeds, repository: "NoteFeed::Repository", foreign_key: :project_id
```

### Instance Methods

Add business logic helpers directly on the Record:

```ruby
# Password verification (IAM Account)
def password_match?(password)
  return false unless hashed_password
  BCrypt::Password.new(hashed_password) == password
end

# Expiry check (IAM ApiKey)
def expired?
  return false if expires_at.nil?
  expires_at < Time.now
end

def revoked?
  !revoked_at.nil?
end

def valid_key?
  !expired? && !revoked?
end

# File access (Media Medias, Sync Exports)
def open
  Verse::Plugin[:shrine].with_storage do |storage|
    storage.open(id)
  rescue Shrine::FileNotFound
    raise Verse::Error::NotFound, "File not found"
  end
end

# Scope builder (IAM ApiKey)
def build_scope
  case scope_type
  when "all"   then {}
  when "org"   then { org: scope_value.map(&:to_s) }
  when "project" then { project: scope_value.map(&:to_s) }
  else {}
  end
end
```

---

## Repository Declarations

### Required Configuration

```ruby
class Repository < Verse::Sequel::Repository
  self.table = "entries"
  self.resource = Resource::Dataset::Entries
end
```

| Setting | Purpose |
|---------|---------|
| `self.table = "table_name"` | The SQL table name. Must match the migration. |
| `self.resource = Resource::Service::Entity` | Used for event channel naming and auth scope validation. |

### Custom Filters

Custom filters extend the query interface for API callers (exposition → service → repository). They operate on a Sequel dataset and accept values parsed from query parameters:

```ruby
custom_filter :role_name__nin do |collection, role_name|
  collection.where(Sequel.lit("role_name NOT IN ?", role_name))
end

custom_filter :with_role_scope do |collection, role_scope|
  role_scope = role_scope.to_json unless role_scope.is_a?(String)
  collection.where(Sequel.lit("role_scope @> ?", role_scope))
end

custom_filter :participated do |collection, value|
  where_fragment = <<-SQL
    assigned_to_id = :account_id
    OR submitted_by_id = :account_id
    OR reviewed_by_id = :account_id
  SQL
  collection.where(Sequel.lit(where_fragment, account_id: value))
end

custom_filter :assigned do |collection, value|
  assigned = value.to_s.downcase == "true"
  if assigned
    collection.where(Sequel.lit("assigned_to_id IS NOT NULL"))
  else
    collection.where(Sequel.lit("assigned_to_id IS NULL"))
  end
end

custom_filter :organization_id__in do |collection, value|
  where_fragment = <<-SQL
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.organization_id IN ?
        AND p.id = project_members.project_id
    )
  SQL
  collection.where(Sequel.lit(where_fragment, value.map(&:to_i)))
end

custom_filter :enabled do |collection, value|
  enabled = value.to_s.downcase == "true"
  if enabled
    collection.where(disabled_at: nil)
  else
    collection.where(Sequel.~(disabled_at: nil))
  end
end

custom_filter :actor_account_role_name__nin do |collection, value|
  collection.where(
    Sequel.lit("actor_account_role_name NOT IN ? OR actor_account_role_name IS NULL", value)
  )
end
```

The filter name convention uses double underscores for operators: `role_name__nin` → "NOT IN", `scheduled_at__lte` → "≤" (built-in operators), `organization_id__in` → custom "IN" with subquery. Double underscores distinguish the filter name from column names.

### Auth Scoping

**This is the most critical requirement.** Every repository **must** implement `scoped(action)`. This method is called automatically by built-in CRUD operations (`index`, `find`, `update!`, `delete!`) and must be called explicitly in custom query methods.

```ruby
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }

    scope.as_org_owner? do
      org_ids = auth_context.custom_scopes[:org]
      project_ids = auth_context.custom_scopes[:project]

      if org_ids
        table.where(
          table.db[:projects]
            .where(organization_id: org_ids)
            .where(id: Sequel[:entries][:project_id])
            .select(1).exists
        )
      elsif project_ids
        table.where(project_id: project_ids)
      else
        table.where(Sequel.lit("false"))
      end
    end

    scope.as_user? { user_project_scoped_query(action) }
  end
end
```

#### How the `scope` DSL Works

`auth_context.can!` evaluates the current user's role rights for the given `action` + `resource`. The block yields a `scope` object with condition methods that correspond to **role scope levels** defined in the role YAML files:

| Scope DSL | Triggered When Role Has Scope | Purpose |
|-----------|-------------------------------|---------|
| `scope.all? { table }` | `"all"` | Full table access (system admins, service accounts). |
| `scope.as_org_owner? { ... }` | `"org"` | Access scoped to organizations the user owns/manages. |
| `scope.as_user? { ... }` | `"user"` | Access scoped to the user's own memberships. |
| `scope.own { ... }` | `"own"` | Access scoped to records owned by the user (e.g., own account). |
| `scope.array? { \|x\| ... }` | `"array"` | Custom array-based scope (e.g., create-only actions). |

The role system evaluates **all matching scope levels**. For example, an org owner with both `"all"` and `"org"` scopes would have both `scope.all?` and `scope.as_org_owner?` blocks executed — the final scoped dataset is the **union** (from `can!`) of all applicable scoped queries.

The typical pattern is:

1. `scope.all? { table }` — always provide a base.
2. `scope.as_org_owner? { ... }` — filter by `auth_context.custom_scopes[:org]` / `[:project]`.
3. `scope.as_user? { ... }` — filter by project membership, assignment, or ownership.

**Never bypass scoping.** The only exception is `use_system_repo` in service code, used sparingly for workflow transitions that reassign entries (e.g., unassigning all entries from a member being removed).

#### Real-world scoped patterns

**Simple scoping** (Account — IAM):
```ruby
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }
    scope.as_org_owner? { accounts_from_project_member_scoped }
    scope.own { table.where(id: auth_context.metadata[:id]) }
  end
end
```

**Action-dependent scoping** (Entry — Dataset):
```ruby
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }

    scope.as_org_owner? do
      # org_owners see entries from their org's projects
    end

    scope.as_user? { user_project_scoped_query(action) }
  end
end

# Actions                | Roles
# read                   | project_owner, annotator(assigned), reviewer(assigned)
# create, update, delete | project_owner
query
def user_project_scoped_query(action)
  return table if action == :create

  case action
  when :read, :submit
    # complex SQL with project_members join, role checks, assignment checks
  when :update, :delete
    # only project_owners
  end
end
```

**Cross-service scoping** (Sync Exports):
```ruby
scope.as_org_owner? {
  project_ids = Api[:idah].dataset.projects.index_all(
    filter: { organization_id: org_ids },
    fields: { "dataset:projects": ["id"] }
  ).map(&:id)
  table.where(project_id: project_ids)
}
scope.as_user? {
  project_ids = Api[:idah].dataset.project_members.index_all(
    filter: { account_id:, role: "project_owner", enabled: true },
    fields: { "dataset:project_members": ["project_id"] }
  ).map(&:project_id).uniq
  table.where(project_id: project_ids)
}
```

**No-scope repositories** (Audit Log — read-only, no entity-based scoping needed):
```ruby
# app/audit/app/model/log.rb
class Repository < Verse::Sequel::Repository
  self.table = "logs"
  self.resource = "audit:logs"

  custom_filter :actor_account_role_name__nin do |collection, value|
    collection.where(
      Sequel.lit("actor_account_role_name NOT IN ? OR actor_account_role_name IS NULL", value)
    )
  end

  # No scoped method = inherits default from Verse::Sequel::Repository
end
```

### Event Publishing

Events are published automatically when repository methods modify data. There are three patterns:

#### Decorator-based

The `event(name:)` decorator publishes an event with the channel `{resource}:{name}` after the method completes successfully:

```ruby
event(name: "logged_in")
def login(email, password)
  account = scoped(:login).where(email:).first

  if account
    account = decode(account)
    account = self.class.model_class.new(account)
    valid = account.password_match?(password)

    add_event_metadata(
      actor_account_id: account.id,
      actor_account_email: account.email,
      actor_account_role_name: account.role_name,
      validation: valid
    )
  else
    sleep(rand(0.3..0.5))
    valid = false
  end

  valid ? account : nil
end
# Publishes: "iam:accounts:logged_in"

event(name: "assigned")
def assign(id, attributes)
  # ...
end
# Publishes: "dataset:entries:assigned"

event(name: "completed")
def complete(id)
  no_event { update!(id, { status: "completed", progress: 1.0 }) }
end
# Publishes: "media:jobs:completed"

event(name: "updated")
def set(key, value)
  # ...
end
# Publishes: "setting:settings:updated"
```

#### Metadata enrichment with `with_metadata`

For CRUD overrides that need additional event context:

```ruby
def create(attributes)
  with_metadata do
    add_event_metadata(
      project_id: attributes[:project_id],
      dataset_id: attributes[:dataset_id]
    )

    super(attributes)
  end
end

def update!(id, attributes, scope: scoped(:update))
  with_metadata do
    entry = find!(id)

    add_event_metadata(
      project_id: attributes[:project_id] || entry.project_id,
      dataset_id: attributes[:dataset_id] || entry.dataset_id,
      entry_id: id
    )

    super(id, attributes, scope:)
  end
end

def delete!(id)
  with_metadata do
    entry = find!(id)

    add_event_metadata(
      project_id: entry.project_id,
      dataset_id: entry.dataset_id,
      entry_id: id
    )

    super(id)
  end
end
```

The standard `add_event_metadata` helper in each repository:

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

**Key rule:** `with_metadata` MUST wrap any CRUD override that calls `add_metadata`. Without it, metadata will be lost.

#### Suppress events with `no_event`

When a method internally calls another repository method that would normally publish an event, wrap it in `no_event` to prevent duplicate or unwanted events:

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
  no_event do
    transaction do
      update!(id, attributes)
    end
  end
end

event(name: "progressed")
def update_progress(id, value)
  no_event do
    update!(id, { progress: value })
  end
end
```

### Encoders

Encoders handle serialization/deserialization for non-native column types:

```ruby
# JSONB columns
encoder :arguments, Verse::Sequel::JsonEncoder          # Jobs
encoder :meta, Verse::Sequel::JsonEncoder               # Medias
encoder :role_scope, Verse::Sequel::JsonEncoder         # Account
encoder :position, Verse::Sequel::JsonEncoder           # NoteFeed
encoder :labeling_configuration, Verse::Sequel::JsonEncoder
encoder :workflow_configuration, Verse::Sequel::JsonEncoder
encoder :dimensions, Verse::Sequel::JsonEncoder         # Annotation
encoder :annotation, Verse::Sequel::JsonEncoder
encoder :metadata, Verse::Sequel::JsonEncoder
encoder :value, Verse::Sequel::JsonEncoder              # Setting (JSONB store)

# PostgreSQL Array columns
encoder :permissions, Verse::Sequel::PgArrayEncoder     # ApiKey
encoder :scope_value, Verse::Sequel::PgArrayEncoder     # ApiKey
encoder :labels, Verse::Sequel::PgArrayEncoder          # Dataset
```

### Custom Query Methods

Beyond CRUD, repositories implement domain-specific queries. These must explicitly apply scoping:

```ruby
# Job locking with FOR UPDATE SKIP LOCKED (media service)
def lock_available(count = 1, now: Time.now)
  transaction do
    scope = table.for_update.skip_locked
    jobs = index(
      { status: "pending", scheduled_at__lte: now },
      sort: "-priority",
      items_per_page: count,
      scope:,
    )

    jobs.each { |job| update!(job.id, { status: "running" }) }
    jobs
  end
end

# Next scheduled time (media jobs polling)
def next_scheduled_time
  table.select(Sequel.lit("min(scheduled_at)")).where(status: "pending").first[:min]
end

# Session sequence check with optimistic locking (IAM)
def check_seq(account_id, session_id, nonce, sequence)
  with_db_mode :rw do |_db|
    new_sequence = sequence + 30
    updated = table.with_sql(<<~SQL, account_id:, session_id:, nonce:, refresh_seq: new_sequence)
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

# Key-value set with upsert (Setting service)
def set(key, value)
  table = scoped(:update)
  value = Sequel.lit("?::jsonb", value.to_json)
  table.insert_conflict(target: %i[key], update: { value: }).insert({ key:, value: })
  true
end

# Bulk insert (EntryStat)
def bulk_insert(entry_id, stats_hash)
  now = Time.now
  rows = stats_hash.map do |key, value|
    { id: UUIDv7.generate, entry_id:, key: key.to_s, value: value.to_s,
      created_at: now, updated_at: now }
  end
  table.db[:entry_stats].multi_insert(rows) unless rows.empty?
end
```

### Special `use_system_repo`

When a service needs to bypass auth scoping (e.g., workflow transitions that reassign entries), it uses `use_system_repo`:

```ruby
# In service layer
def unassign_all(project_member)
  use_system_repo(Entry::Repository) do |repo|
    repo.scoped(:update).where(assigned_to_id: project_member.account_id)
        .update(assigned_to_id: nil)
  end
end
```

This creates a repository instance without an auth context. **Use sparingly** — it bypasses all authorization checks.

---

## In-Memory Repository

For data that doesn't live in PostgreSQL (roles loaded from YAML files), use `Verse::Model::InMemory::Repository`:

```ruby
# common/lib/role_repository.rb
class RoleRepository < Verse::Model::InMemory::Repository
  self.primary_key = "name"
  self.resource = "iam:roles"

  ROLE_PATH = File.join(COMMON_PATH, "/data/roles")

  def self.load
    data.clear
    repo = new(Verse::Auth::Context.new)

    Dir.glob("#{ROLE_PATH}/**/*.yml").each do |file|
      next if file =~ /templates/
      repo.load_role(YAML.safe_load(File.read(file)))
    end
  end

  def load_role(hash)
    no_event do
      hash.each do |name, attribute|
        create(
          name:,
          title: attribute.fetch("title", name),
          rights: unfold_rights(attribute["rights"]),
          scopes: attribute.fetch("scopes", []),
          labels: attribute.fetch("labels", []),
          description: attribute.fetch("description", NO_DESC),
          assignable: attribute.fetch("assignable", false)
        )
      end
    end
  end
end
```

In-memory repositories share the same interface (`create`, `update!`, `delete!`, `index`, `find_by`) but operate on an in-process Hash. Events work the same way. They are loaded at boot time and are read-mostly at runtime.

---

## Common Patterns & Gotchas

### CRUD Override Checklist

When overriding `create`, `update!`, or `delete!`, always:

1. Wrap in `with_metadata { ... }` to capture event metadata.
2. Call `add_event_metadata(...)` with domain-specific context (project_id, dataset_id, entry_id, etc.).
3. Call `super(...)` for the actual database operation.
4. In `update!`, accept and forward the `scope:` keyword argument.

```ruby
def create(attributes)
  with_metadata do
    add_event_metadata(project_id: attributes[:project_id])
    super(attributes)
  end
end

def update!(id, attributes, scope: scoped(:update))
  with_metadata do
    record = find!(id)
    add_event_metadata(project_id: attributes[:project_id] || record.project_id)
    super(id, attributes, scope:)
  end
end

def delete!(id)
  with_metadata do
    record = find!(id)
    add_event_metadata(project_id: record.project_id)
    super(id)
  end
end
```

### Event Decorator + `no_event` Pairing

Named events (like `"assigned"`, `"completed"`, `"selected"`) usually pair the `event(name:)` decorator with `no_event { update!(...) }` internally. This ensures the named event fires exactly once, and the standard "updated" event from `update!` is suppressed.

### Scoped Queries in Custom Methods

Any custom query method that accesses the database must explicitly scope:

```ruby
def assign(id, attributes)
  entry = find!(id)                          # uses default scoped(:read)

  no_event do
    transaction do
      update!(id, attributes)                # uses default scoped(:update)
    end
  end
end

# Or pass a custom scope:
def resolve!(id)
  update!(id, { status: "resolved" }, scope: scoped(:resolve))
  find!(id)
end
```

### Transactions

Use `transaction do ... end` for atomic operations:

```ruby
transaction do
  update!(entry.id, { status: status })
end
```

The `with_db_mode :rw do |db| ... end` block is available for operations that need to explicitly target the read-write replica:

```ruby
with_db_mode :rw do |_db|
  # Force read-write connection
end
```

### Sequel DSL Usage

This is **not Rails.** Use Sequel syntax exclusively:

```ruby
# Correct
Sequel.lit("role_name IN ?", role_names)
table.where(Sequel.lit("false"))
table.where(Sequel.~(disabled_at: nil))
table.for_update.skip_locked
table.insert_conflict(target: %i[key], update: { value: }).insert(...)
table.db[:entry_stats].multi_insert(rows)
table.with_sql("UPDATE ... RETURNING id", ...)

# Never ActiveRecord patterns like:
# Model.where(...)        ← wrong
# .update_all(...)        ← wrong
```

### UUID Generation

Use `UUIDv7.generate` for UUID primary keys — never `SecureRandom.uuid`:

```ruby
field :id, type: String, primary: true
# In code:
id: UUIDv7.generate
```

### String vs Constant for `repository:` in Associations

Use string references for associations to avoid circular load issues:

```ruby
belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
# Not: repository: Entry::Repository
```

This is especially important in apps like Dataset where many models reference each other.

### Cross-Service API Calls from Repositories

Repositories may call other services via the internal API client (`Api[:service_name]`):

```ruby
def accounts_from_project_member_scoped
  account_id = auth_context.metadata[:id]
  org_ids = auth_context[:org] || []

  membership_account_ids =
    if org_ids.any?
      Api[:idah].dataset.project_members.index(
        filter: { organization_id__in: org_ids, enabled: true }
      ).data.map(&:account_id).uniq
    else
      []
    end

  table.where(id: [account_id] + membership_account_ids)
end
```

This is acceptable for scoping (read-only). For write operations across services, go through the service layer, not the repository.

---

## Summary

| Concept | Pattern |
|---------|---------|
| **File** | `app/{service}/app/model/entity.rb` — one module, two classes (Record + Repository) |
| **Record** | Fields, associations, resource type, helper methods |
| **Repository** | Table config, custom filters, scoping, CRUD overrides, events, encoders |
| **Scoping** | `scoped(action)` with `scope.all? / .as_org_owner? / .as_user? / .own` |
| **Events** | `event(name:)` decorator, `with_metadata` for CRUD overrides, `no_event` for suppression |
| **Encoders** | `JsonEncoder` for JSONB, `PgArrayEncoder` for PostgreSQL arrays |
| **In-Memory** | `Verse::Model::InMemory::Repository` for YAML-backed data (roles) |
| **Auth bypass** | `use_system_repo` only when unavoidable (workflow transitions) |
