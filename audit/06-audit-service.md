# Audit Service — Code Audit

## Executive Summary

The IDAH Audit service is a small Verse-based Ruby service that subscribes to resource events from IAM, Dataset, and Media services and persists them as rows in a single `logs` table. The codebase is clean and the migration ships a sensible set of single-column and composite indexes for the common time-range queries. However, the service has a **critical authorization gap**: the `Log::Repository` does not override `scoped(action)`, so the default Verse scope is used. Combined with the fact that **no role in `common/data/roles/` grants any right on `audit:logs`**, every non-system caller is rejected by the framework — meaning the HTTP `/logs` endpoints are effectively unusable by real users (admin, org_owner, user) today. The intended design is unclear; either the role files are missing `audit:logs.*.*` grants (in which case the feature is dead) or, if those grants are added without a corresponding `scoped` override, every authenticated account will be able to read every other account's audit history across all organizations (IDOR). Additional concerns include unbounded default page size (1000), PII (actor emails) stored in plaintext and indexed, no retry/DLQ handling on event subscribers, and a `Sequel.lit` interpolation in the custom `__nin` filter that is currently safe only by accident.

---

## Findings

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| AUD-001 | Critical | Security / Architecture | `app/model/log.rb:29-36` | `Log::Repository` has no `scoped(action)` override — no per-org/per-project isolation on audit reads |
| AUD-002 | Critical | Security | `common/data/roles/*.yml` (all) | No role grants any right on `audit:logs` — `/logs` HTTP endpoints reject every real user |
| AUD-003 | High | Security / Privacy | `app/model/log.rb:10-11`, migration L10-11 | Actor email and role name persisted in plaintext and indexed (PII at rest + searchable) |
| AUD-004 | High | Security | `app/expo/logs_expo.rb:40-48` | Failed-login events record the victim account's email/role even when authentication fails |
| AUD-005 | High | Security | `app/expo/logs_expo.rb:33-165` | Event subscribers run as `Verse::Auth::Context[:system]` and never validate event source / payload shape |
| AUD-006 | Medium | Performance | `app/service/log/service.rb:7`, `verse-jsonapi` DSL default | Default `items_per_page` is 1000 with no server-side cap below the framework max |
| AUD-007 | Medium | CodeSmell / Security | `app/model/log.rb:33-35` | `Sequel.lit("actor_account_role_name NOT IN ? ...", value)` — raw SQL fragment, safe only because Sequel parameterizes the placeholder |
| AUD-008 | Medium | Architecture | `app/expo/logs_expo.rb:171-188` | Business logic (event-to-log attribute mapping) lives in the exposition, not the service layer |
| AUD-009 | Medium | Reliability | `app/expo/logs_expo.rb:33-165`, `verse-core` `event_bus.rb:111-130` | No retry / DLQ / poison-message handling on audit event subscribers; failures are logged and re-raised |
| AUD-010 | Low | CodeSmell | `app/expo/logs_expo.rb:30,167` | `Style/CombinableLoops` rubocop disable hints the repeated `each` blocks are awkward; large duplication across event handlers |
| AUD-011 | Low | CodeSmell | `app/expo/logs_expo.rb:172` | `service, type, action = message.event.split(":")` shadows the `service` helper from `use_service` |
| AUD-012 | Low | Architecture | `app/model/log.rb:31` | `self.resource = "audit:logs"` hardcoded string instead of `Resource::Audit::Logs` constant (defined in `common/lib/resource/audit.rb`) |
| AUD-013 | Info | Performance | `db/migrations/20251114000000_create_initial_schema.rb:35-42` | Good composite index coverage for `(filter, event_timestamp)` queries — no action required |
| AUD-014 | Info | Security | `config/initializers/set_keys.rb:20` | JWT signing key loaded from env/path; acceptable, but no validation that the key is the expected curve beyond `OpenSSL::PKey::EC.new` |
| AUD-015 | Low | CodeSmell | `app/service/log/service.rb:7-16` | Service is a thin pass-through; `index`/`show` add no value over the repository and could be removed or used to enforce authorization rules |

---

## Finding Details

### AUD-001 — `Log::Repository` has no `scoped(action)` override
**Severity:** Critical · **Category:** Security / Architecture · **Effort:** M

**Description**
Every other repository in the codebase (`Annotation`, `Dataset`, `Entry`, `Project`, `ProjectMember`, `NoteFeed`, `NoteComment`, `EntryStat`, `Account`, `AccountSession`) overrides `scoped(action)` to call `auth_context.can!(action, resource)` with `scope.all?`, `scope.as_org_owner?`, `scope.as_user?`, etc. `Log::Repository` (`app/model/log.rb:29-36`) does not. It inherits the default Verse implementation:

```ruby
# verse-sequel/lib/verse/sequel/repository.rb:158
def scoped(action)
  @auth_context.can!(action, self.class.resource) do |scope|
    scope.all?    { table }
    scope.custom? { |id| table.where(pkey => id) }
  end
end
```

So any caller with the `audit:logs.read.*` right sees **every row in the `logs` table** — across all organizations, all projects, all users — with no `organization_id` / `project_id` filtering.

**Impact**
If (when) `audit:logs` rights are added to role files (see AUD-002), any non-system account that is granted read access can read the entire audit history of every other tenant. This is a cross-organization IDOR on the most sensitive table in the system. Even today, the `system` auth context used by the event subscribers bypasses scoping entirely, which is correct for ingestion but means there is no tested code path that exercises org-scoped reads.

**Evidence**
```ruby
# app/model/log.rb
class Repository < Verse::Sequel::Repository
  self.table = "logs"
  self.resource = "audit:logs"

  custom_filter :actor_account_role_name__nin do |collection, value|
    collection.where(Sequel.lit("actor_account_role_name NOT IN ?  OR actor_account_role_name IS NULL", value))
  end
end
```
Compare with `app/dataset/app/model/dataset.rb:39-70` which has a full `scoped` override with `as_org_owner?` / `as_user?` branches.

**Recommendation**
Implement `scoped(action)` in `Log::Repository` mirroring the dataset pattern, e.g.:
```ruby
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }
    scope.as_org_owner? do
      org_ids = auth_context.custom_scopes[:org]
      org_ids ? table.where(organization_id: org_ids) : table.where(false)
    end
    scope.as_user? { table.where(actor_account_id: auth_context.metadata[:id]) }
  end
end
```
Decide explicitly whether org owners see all actors in their org (likely yes) and whether end users see only their own entries (likely yes). Add RSpec coverage for both branches before granting any `audit:logs` rights.

---

### AUD-002 — No role grants any right on `audit:logs`
**Severity:** Critical · **Category:** Security · **Effort:** S

**Description**
`grep` over `common/data/roles/` (including `api_scopes/`) returns zero matches for `audit`. The role files for `admin` (`8.0.0_admin.yml`), `org_owner` (`2.0.0_org_owner.yml`), and `user` (`1.0.0_user.yml`) grant rights on `iam:*`, `dataset:*`, `media:*`, `sync:*`, `setting:*` but nothing on `audit:logs`.

**Impact**
The `LogsExpo` `index`/`show` HTTP endpoints (`app/expo/logs_expo.rb:13-28`) are reachable only by the `system` role (`9.9.9_system.yml` grants `*.*.*`). Any real user (admin included) calling `GET /logs` will hit `auth_context.can!(:read, "audit:logs")`, find no matching scope, and be rejected with `Verse::Error::Unauthorized`. The feature is effectively dead for end users. Worse, the moment someone "fixes" this by adding `audit:logs.read.*` to the admin role without also fixing AUD-001, they will open a cross-org IDOR.

**Evidence**
```
$ grep -rn audit common/data/roles/
(no matches)
```
```ruby
# common/data/roles/9.9.9_system.yml
system:
  mask: "9.9.9"
  assignable: false
  rights:
    - "*.*.*"
```

**Recommendation**
1. Decide the intended authorization model for audit logs (admin-only? org_owner-scoped?).
2. Add explicit `audit:logs.read.<scope>` rights to the appropriate role files.
3. Implement AUD-001 in the same change so the two never drift apart.
4. Add an integration spec that exercises `GET /logs` as admin, org_owner, and user.

---

### AUD-003 — Actor email and role persisted in plaintext and indexed (PII)
**Severity:** High · **Category:** Security / Privacy · **Effort:** M

**Description**
The `logs` table stores `actor_account_email` and `actor_account_role_name` as plain `String` columns, each with its own B-tree index (`db/migrations/20251114000000_create_initial_schema.rb:10-11`, plus composite `[actor_account_email, event_timestamp]` at L36). These are populated from event metadata in `app/expo/logs_expo.rb:183-184`.

**Impact**
- PII (email addresses) is stored in plaintext in an append-only audit table that is rarely purged — exactly the kind of data subject to GDPR / similar retention requirements.
- Indexed plaintext emails make bulk extraction trivial for anyone with read access (see AUD-001).
- Role names leak the organizational position of every actor indefinitely.

**Evidence**
```ruby
# app/model/log.rb
field :actor_account_email, type: [String, NilClass], readonly: true
field :actor_account_role_name, type: [String, NilClass], readonly: true
```
```ruby
# migration
column :actor_account_email, String, null: true, index: true
column :actor_account_role_name, String, null: true, index: true
...
add_index :logs, [:actor_account_email, :event_timestamp]
```

**Recommendation**
- Drop `actor_account_email` and `actor_account_role_name` from the persisted log row; keep only `actor_account_id` and join to the IAM `accounts` table at query time (with appropriate caching).
- If denormalization is required for performance, store a hashed or truncated representation and drop the standalone indexes on these columns.
- Add a retention / cleanup job for the `logs` table.

---

### AUD-004 — Failed-login audit entries leak the victim account
**Severity:** High · **Category:** Security · **Effort:** S

**Description**
`app/expo/logs_expo.rb:40-48` subscribes to `Resource::Iam::Accounts` `logged_in` events and rewrites the action to `failed_log_in_attempt` when `metadata[:validation]` is falsy. The IAM `Account::Repository#login` (`app/iam/app/model/account.rb:62-86`) attaches `actor_account_id`, `actor_account_email`, and `actor_account_role_name` to **both** successful and failed login attempts.

**Impact**
An attacker spraying passwords against a known email causes the victim's account id, email, and role to be written to the audit log on every failed attempt. Combined with AUD-001/AUD-002, this is a reconnaissance goldmine. Even without that, the audit log becomes a high-volume PII sink during any credential-stuffing incident.

**Evidence**
```ruby
# app/iam/app/model/account.rb:72-77
add_event_metadata(
  actor_account_id: account.id,
  actor_account_email: account.email,
  actor_account_role_name: account.role_name,
  validation: valid
)
```
```ruby
# app/audit/app/expo/logs_expo.rb:40-48
expose on_resource_event(Resource::Iam::Accounts, "logged_in")
def on_account_logged_in
  service.create(
    log_attributes(
      message:,
      action: message.content[:metadata][:validation] ? "logged_in" : "failed_log_in_attempt"
    )
  )
end
```

**Recommendation**
For failed login attempts, persist only a redacted identifier (e.g. `actor_account_email = "[redacted]"` or a hash of the email) and omit `actor_account_role_name`. Better: emit a separate `failed_log_in_attempt` event from IAM with intentionally limited metadata so the audit service does not have to know about the distinction.

---

### AUD-005 — Event subscribers run as system and do not validate source/payload
**Severity:** High · **Category:** Security · **Effort:** M

**Description**
Verse's `EventBus#auth_context_for` (`verse-core/.../exposition/hook/event_bus.rb:74-76`) hard-codes `Verse::Auth::Context[:system]` for every event subscriber. `LogsExpo` then calls `service.create(...)` which calls `Log::Repository#create`, which calls `scoped(:create)` — but the system context matches `*.*.*` so the check is a no-op. None of the handlers in `app/expo/logs_expo.rb:33-165` validate:
- that `message.event` is non-empty (otherwise `service, type, action = message.event.split(":")` produces `nil`s),
- that `message.content[:metadata]` exists (multiple `[:metadata][:organization_id]` accesses would raise `NoMethodError` on `nil`),
- that the publishing service is one of the expected ones.

**Impact**
Any service (or anything that can publish to Redis) that gains the ability to emit a `iam:accounts.created` event can write arbitrary rows into the audit log, including arbitrary `actor_account_email` values. A malformed event will crash the subscriber (see AUD-009) and, depending on Redis ack config, may poison the stream.

**Evidence**
```ruby
# app/audit/app/expo/logs_expo.rb:171-185
def log_attributes(message:, **additional_attributes)
  service, type, action = message.event.split(":")
  resource_id = message.content[:resource_id]
  metadata = message.content[:metadata]

  attributes = {
    action: action,
    resource_service: service,
    resource_type: type,
    resource_id:,
    event_timestamp: metadata[:at],
    actor_account_id: metadata[:actor_account_id],
    actor_account_email: metadata&.[](:actor_account_email),
    actor_account_role_name: metadata&.[](:actor_account_role_name),
  }
  ...
end
```

**Recommendation**
- Centralize payload validation in `Log::Service#create` (reject or sanitize missing/nil fields, cap string lengths).
- Consider validating `message.subject` / origin against an allowlist of trusted service names if Verse exposes it.
- Wrap each handler in `begin/rescue` and route unrecoverable messages to a dead-letter channel.

---

### AUD-006 — Default page size of 1000 with no service-side cap
**Severity:** Medium · **Category:** Performance · **Effort:** S

**Description**
`Log::Service#index` (`app/service/log/service.rb:7`) defaults `items_per_page: 1000`, matching the framework default in `verse-jsonapi/lib/verse/json_api/dsl/index.rb:28` (`instruction :max_items_per_pages, 1000`). The `index_impl` in `verse-sequel` will happily run `LIMIT 1000 OFFSET ...` and, when `query_count` is set, run a separate `COUNT(*)` limited to 1000 rows.

**Impact**
- A single unfiltered `GET /logs` returns up to 1000 wide rows (each containing email, role, multiple ids, two timestamps) per request — easy to amplify into multi-MB responses.
- The default sort is on `logs.id`, which is fine, but combined with deep `page` values this still scans-and-skips a lot of rows.
- No `max_items_per_pages` override on the `index` block means the framework cap is the only protection.

**Evidence**
```ruby
# app/audit/app/service/log/service.rb
def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
  logs.index(filter, included: included, page: page, items_per_page: items_per_page, ...)
end
```

**Recommendation**
Lower the default `items_per_page` to 100 (or 50) for audit logs and consider setting `max_items_per_pages` explicitly in the `index` block of `LogsExpo`. Require at least one filter (e.g. `event_timestamp__gte`) for unprivileged callers.

---

### AUD-007 — Raw SQL fragment in custom `__nin` filter
**Severity:** Medium · **Category:** CodeSmell / Security · **Effort:** S

**Description**
`app/model/log.rb:33-35` defines a custom filter using `Sequel.lit` with a string that includes both a placeholder (`?`) and a literal column name:

```ruby
custom_filter :actor_account_role_name__nin do |collection, value|
  collection.where(Sequel.lit("actor_account_role_name NOT IN ?  OR actor_account_role_name IS NULL", value))
end
```

**Impact**
This is currently safe because Sequel parameterizes the `?` placeholder and the column name is hardcoded. However:
- The pattern is fragile — any future edit that interpolates `value` directly into the string would create a SQL injection.
- The built-in `neq` operator already handles `NOT IN` for arrays (see `verse-sequel/filtering_pg.rb:25-49`), so this custom filter is partially redundant.
- The double space before `OR` is a typo.

**Recommendation**
Use Sequel's DSL: `collection.where(Sequel.~(actor_account_role_name: value).or(actor_account_role_name: nil))` or rely on the built-in `actor_account_role_name__neq` filter (which already handles arrays and `NULL`).

---

### AUD-008 — Business logic in the exposition layer
**Severity:** Medium · **Category:** Architecture · **Effort:** M

**Description**
`LogsExpo#log_attributes` (`app/expo/logs_expo.rb:171-188`) parses `message.event`, extracts metadata, and assembles the attribute hash that becomes a log row. Each event handler also makes decisions about which metadata keys to copy (e.g. `organization_id`, `project_id`, `dataset_id`, `submission_type`, `media_resource`). This is business logic that belongs in `Log::Service` per the project's Golden Rule #1 ("Never put business logic in expositions").

**Impact**
- The exposition layer now depends on the wire format of every upstream service's events.
- Any change to event metadata shape ripples through the exposition.
- Hard to unit-test the mapping in isolation.

**Evidence**
See `app/expo/logs_expo.rb:33-188` — the entire file is mapping logic plus a `service.create` call.

**Recommendation**
Move `log_attributes` and the per-event attribute enrichment into `Log::Service`, e.g. `Log::Service.create_from_message(message)` or one factory method per resource family. The exposition should only dispatch.

---

### AUD-009 — No retry / DLQ / poison-message handling on subscribers
**Severity:** Medium · **Category:** Reliability · **Effort:** M

**Description**
`LogsExpo` subscribes via `expose on_resource_event(...)` with the default `ack_type: :auto` (see `verse-core/.../exposition/hook/event_bus_methods.rb:21`). The dispatcher (`verse-core/.../exposition/hook/event_bus.rb:111-130`) rescues `StandardError`, logs a warning, and then `raise output` — re-raising the error after the message has already been acknowledged.

**Impact**
- A single bad event (e.g. missing `metadata[:at]` causing a `TypeError` on `event_timestamp`) will crash the subscriber forever; on Redis Streams with `ack: :auto` the message is redelivered, but there is no maximum-retry counter or dead-letter queue.
- The `on_entry_event` and `on_media_event` handlers (`app/expo/logs_expo.rb:122, 156`) silently `return` when `actor_account_id` is missing — this is the only "poison message" mitigation in the file, and it is applied inconsistently (other handlers do not guard).

**Evidence**
```ruby
# verse-core event_bus.rb
rescue StandardError => e
  Verse.logger&.warn{ "Error while processing for method at #{@method.source_location.join(":")}" }
  Verse.logger&.warn(e)
  is_error = true
  output = e
end
...
raise output if is_error
```

**Recommendation**
- Add explicit `begin/rescue` around `service.create` in each handler; log and acknowledge malformed events to a `audit:logs:errors` stream.
- Consider switching to `ack_type: :manual` once Verse supports it for this use case.
- Add a maximum-redelivery header and route to a DLQ after N attempts.

---

### AUD-010 — Repeated `each` blocks and rubocop disable
**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
`app/expo/logs_expo.rb:30,167` wraps the file in `# rubocop:disable Style/CombinableLoops` because the same `%w[created updated deleted].each do |event|` pattern is repeated for accounts, organizations, projects, project_members, datasets, entries, and medias. Each block defines a method named after the resource family (`on_account_event`, `on_organization_event`, etc.).

**Impact**
- ~130 lines of near-identical code; adding a new resource family requires copying a block and remembering the right metadata keys.
- The rubocop disable masks the fact that these loops could be combined into a data-driven dispatcher.

**Recommendation**
Extract a small DSL, e.g.:
```ruby
{
  Resource::Iam::Accounts        => { events: %w[created updated deleted] },
  Resource::Dataset::Projects    => { events: %w[created updated deleted], metadata: [:organization_id], resource_id: :project_id },
  ...
}.each do |resource, config|
  config[:events].each do |event|
    expose on_resource_event(resource, event) { ... }
  end
end
```

---

### AUD-011 — Local variable `service` shadows the `service` helper
**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
`LogsExpo#log_attributes` (`app/expo/logs_expo.rb:172`) does:

```ruby
service, type, action = message.event.split(":")
```

but `service` is also the name of the accessor injected by `use_service Log::Service` (used elsewhere as `service.create(...)`).

**Impact**
Inside `log_attributes`, the local `service` shadows the exposition's service object. Today this is harmless because `log_attributes` does not call `service.create`, but it is a footgun for future edits and confuses static analyzers.

**Recommendation**
Rename the locals: `resource_service, resource_type, action = message.event.split(":")`.

---

### AUD-012 — Hardcoded resource string in repository
**Severity:** Low · **Category:** Architecture · **Effort:** S

**Description**
`app/model/log.rb:31` sets `self.resource = "audit:logs"` as a literal string, even though `common/lib/resource/audit.rb` defines `Resource::Audit::Logs = "audit:logs"` and the `Record` class above it correctly uses `type Resource::Audit::Logs`. The project's Golden Rule #4 explicitly forbids hardcoded resource strings.

**Evidence**
```ruby
class Record < Verse::Model::Record::Base
  type Resource::Audit::Logs          # ✓ constant
  ...
end

class Repository < Verse::Sequel::Repository
  self.table = "logs"
  self.resource = "audit:logs"        # ✗ literal
end
```

**Recommendation**
Replace with `self.resource = Resource::Audit::Logs`.

---

### AUD-013 — Index coverage is good (info, no action)
**Severity:** Info · **Category:** Performance · **Effort:** —

The migration creates single-column indexes on every filterable column and composite `(column, event_timestamp)` indexes for the common time-range query patterns (`db/migrations/20251114000000_create_initial_schema.rb:35-42`). This is appropriate for the filters exposed in `LogsExpo` (`event_timestamp__gte`, `event_timestamp__lte`, `resource_type__in`, `actor_account_id__eq`, etc.). No missing indexes identified for the current query surface.

---

### AUD-014 — JWT key loading has minimal validation
**Severity:** Info · **Category:** Security · **Effort:** S

`config/initializers/set_keys.rb:7-27` reads `SERVICE_JWT_KEY` from env, optionally from a `file:`-prefixed path, and parses it as an EC key. The only validation is whether the resulting key `private?`. There is no check that the key uses the expected curve, no rotation story, and a public key silently disables signing (logged at debug only). Acceptable for the current threat model but worth tightening if audit log integrity depends on JWT-signed events.

---

### AUD-015 — Service layer is a thin pass-through
**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
`Log::Service` (`app/service/log/service.rb`) only forwards `index`, `show`, and `create` to the repository with no added logic. Per the project's Golden Rule #1 the service layer is where business logic belongs; today all the actual logic (event-to-log mapping, see AUD-008) lives in the exposition instead.

**Recommendation**
Either move the mapping logic into the service (preferred — fixes both AUD-008 and AUD-015) or remove the service layer and let the exposition use the repository directly (not recommended; breaks layering).

---

## Files Reviewed

| Path | Status |
|------|--------|
| `app/audit/app/expo/base_expo.rb` | Reviewed |
| `app/audit/app/expo/logs_expo.rb` | Reviewed |
| `app/audit/app/expo/logs_expo_spec.rb` | Reviewed |
| `app/audit/app/model/log.rb` | Reviewed |
| `app/audit/app/service/log/service.rb` | Reviewed |
| `app/audit/app/service/log/service_spec.rb` | Reviewed |
| `app/audit/app/lib/` | Empty (`.gitkeep` only) |
| `app/audit/app/util/` | Empty (`.gitkeep` only) |
| `app/audit/app/spec_helper.rb` | Reviewed |
| `app/audit/config/boot.rb` | Reviewed |
| `app/audit/config/routes.rb` | Reviewed |
| `app/audit/config/puma.rb` | Reviewed |
| `app/audit/config/config.yml` | Reviewed |
| `app/audit/config/initializers/cookies.rb` | Reviewed |
| `app/audit/config/initializers/load_roles.rb` | Reviewed |
| `app/audit/config/initializers/set_keys.rb` | Reviewed |
| `app/audit/db/migrations/20251114000000_create_initial_schema.rb` | Reviewed |
| `app/audit/Gemfile` | Reviewed |
| `app/audit/config.ru` | Reviewed |
| `app/audit/dev-entrypoint.sh` | Reviewed |
| `common/lib/resource/audit.rb` | Reviewed (cross-ref) |
| `common/lib/healthcheck_expo.rb` | Reviewed (registered in `routes.rb`) |
| `common/lib/healthcheck_service.rb` | Reviewed (cross-ref) |
| `common/data/roles/*.yml` | Reviewed (cross-ref for AUD-002) |

No code changes were made. This report is for triage.
