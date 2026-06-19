# Service Layer (Business Logic)

## Role

The Service Layer orchestrates business operations, validation, and multi-repository workflows. It is intentionally thin — it delegates all data access to repositories and focuses solely on coordination, authorization checks, and domain logic.

Services are where business rules live: "an entry can only be submitted if it has no errors," "a user cannot delete their own account," "when an entry transitions to `completed`, notify the dataset owner." These rules are expressed in service methods that compose repository calls, transaction blocks, and auth checks.

## Base Class

All services extend `Verse::Service::Base`.

```ruby
module MyDomain
  class Service < Verse::Service::Base
    # ...
  end
end
```

`Verse::Service::Base` provides:

- **Repository injection** (`use_repo`, `use_system_repo`) — auto-wires repository instances with proper auth scoping.
- **Auth context** (`auth_context`) — the authenticated user's identity and permissions.
- **Event publishing** — services can emit events that expositions subscribe to (though repositories are the canonical place for resource events).
- **Lifecycle hooks** — `before`, `after`, and `around` filters for method calls (e.g., `before :delete, :check_permission`).

## Repository Injection

Services never instantiate repositories directly. Instead, they declare their dependencies using two macros:

### Standard Repositories (auth-scoped)

```ruby
use_repo \
  accounts: Account::Repository,
  sessions: AccountSession::Repository
```

Available as `accounts.method_name(...)`. Every call automatically passes the auth context, which applies `scoped(action)` on the repository side. This ensures the current user can only access records they are authorized to see or mutate.

**Example usage in a service method:**

```ruby
def show_current
  accounts.find!(auth_context.metadata[:id])
end
```

The `accounts.find!` call is equivalent to `Account::Repository.new(auth_context).find!(id)`, with `scoped(:read)` enforced.

### System Repositories (bypass scoping)

```ruby
use_system_repo \
  system_accounts: Account::Repository,
  system_sessions: AccountSession::Repository
```

Available as `system_accounts.method_name(...)`. These bypass auth scoping entirely. They are necessary when the current user may have lost access to a record they need to operate on — for example, after a workflow reassigns an entry away from them.

**When to use system repos:**

| Scenario | Why System Repo? |
|----------|-----------------|
| Workflow transition reassigns an entry to another user | The original submitter may no longer have `:write` access to the entry, but the service still needs to mark the dataset as needing progress update |
| Admin creates a scoped token for a different org member | The admin's auth context scopes to their own resources, but they need to operate on behalf of another user |
| System-level batch operations (e.g., nightly cleanup) | No meaningful "current user" exists |

## Auth Context

The `auth_context` object is injected automatically by the framework. It carries the authenticated user's identity and provides permission checks.

```ruby
auth_context.metadata[:id]     # => "018e3c3e-..." (UUID v7)
auth_context.metadata[:email]  # => "alice@example.com"
auth_context.metadata[:role]   # => "admin"
```

### Permission Checks

```ruby
# Boolean check
auth_context.can?(:update, resource)

# Guard — raises Verse::Error::Authorization on failure
auth_context.can!(:update, resource)

# Attribute-level filtering (JSON:API sparse fieldsets)
auth_context.allowed_fields(resource).include?(field)
```

The resource argument is typically a `Resource::Service::Entity` constant (see [Auth & Authorization guide](auth-authorization.md)) or a record instance. When a record is passed, the repository's scoping rules apply to that specific record.

## Transactions

For operations that span multiple repository calls, use Sequel's transaction support via the repository:

```ruby
repo.transaction do
  result = repo.create(attrs)
  other_repo.update(other_id, other_attrs)
  result
end
```

All repositories declared with `use_repo` share the same database connection, so they participate in the same transaction. If any call raises an exception, the entire transaction rolls back.

**Nested transactions** are supported via Sequel's savepoints. The framework does not open a new connection per transaction; all operations within a request share a single connection.

### Transactional vs Non-Transactional Methods

As a rule of thumb:

- **Write operations** (create, update, delete) that modify multiple records should always use a transaction.
- **Read-only** operations do not need a transaction.
- **Single-repository writes** (e.g., a simple `create`) may omit the explicit transaction block, since the repository's `create` method is already atomic at the SQL level.

## Error Handling

Services raise domain errors that the exposition layer auto-converts to JSON:API error responses. Never rescue these errors inside the service unless you are adding context or performing compensation logic.

| Error Class | HTTP Status | When to Raise |
|-------------|-------------|---------------|
| `Verse::Error::Authorization` | 403 | The current user lacks permission for the action |
| `Verse::Error::RecordNotFound` | 404 | A required record does not exist (use `find!` rather than raising manually) |
| `Verse::Error::ValidationFailed` | 422 | Input validation fails beyond what the exposition layer catches |
| `Verse::Error::InvalidParams` | 400 | Malformed or missing parameters |

### Raising with Detail

```ruby
raise Verse::Error::ValidationFailed, "email_already_taken",
  field: :email, value: params[:email]
```

The extra keyword arguments (`field`, `value`) are included in the JSON:API error response under `meta`, helping frontend forms display per-field errors.

### When to Rescue

Occasionally, a service may need to rescue a repository error and translate it into a domain error:

```ruby
def invite_user(email, role)
  token = repo.transaction do
    account = repo.create(email: email, role: role)
    invite = invite_repo.create(account_id: account.id)
    invite.token
  end
rescue Sequel::UniqueConstraintViolation
  raise Verse::Error::ValidationFailed, "email_already_registered"
end
```

## Inter-Service Communication

Services should never call other services directly within the same process. Instead:

1. **Within the same service**: The service calls its own repositories.
2. **Across services**: Use the inter-service HTTP API client (`common/lib/api.rb`) to call another service's HTTP endpoint.

```ruby
# In Entry::Service, when we need to check the exporting user's identity:
def export(id, format)
  entry = entries.find!(id)
  # Call IAM service via its HTTP API — NOT Account::Service
  user = api_client.get("/v1/accounts/#{entry.assigned_user_id}")
  # ...
end
```

This keeps service boundaries strict and avoids coupling between service domains at the Ruby object level.

## Service Dependencies (use_service)

The `use_service` macro is available but serves a narrow purpose: injection for **exposition-layer rendering helpers**, not for calling business logic. It allows an exposition to call rendering methods defined on another exposition's service.

```ruby
class MyExpo < Verse::Exposition::Base
  use_service other: OtherExpo::Service

  def show
    # other.render_something(...) — rendering helper, not business logic
  end
end
```

Do not use `use_service` to chain business logic calls across services.

## Examples

### Auth::Service

```ruby
module Auth
  class Service < Verse::Service::Base
    use_repo accounts: Account::Repository,
             sessions: AccountSession::Repository
    use_system_repo system_accounts: Account::Repository

    def login(email, password, ip: "", user_agent: nil)
      account = accounts.login(email, password)
      raise Verse::Error::Authorization, "invalid_credentials" if account.nil?
      build_tokens(account, ip:, user_agent:)
    end

    def logout(session_id)
      sessions.delete!(session_id)
    end

    def refresh(token)
      session = sessions.find_by_token!(token)
      raise Verse::Error::Authorization, "token_expired" if session.expired?
      build_tokens(session.account, ip: session.ip, user_agent: session.user_agent)
    end

    private

    def build_tokens(account, ip:, user_agent:)
      # Token generation logic
    end
  end
end
```

### Entry::Service#submit

```ruby
def submit(id, opts = {})
  entry = entries.find!(id, included: ["dataset"])
  workflow = entry.dataset.entry_workflow.new(entries, entry, **opts)
  workflow.submit!
  system_datasets_repo.update_progress!(entry.dataset_id)
  system_entries_repo.find!(entry.id)
end
```

This example illustrates several key patterns:

1. **Auth-scoped read**: `entries.find!(id)` ensures the current user can see the entry before operating on it.
2. **Workflow delegation**: The actual submit logic lives in a workflow object, not in the service itself.
3. **System repo for post-workflow operations**: After the workflow runs, the entry may have been reassigned. Using `system_datasets_repo` and `system_entries_repo` ensures the final read and dataset progress update succeed regardless of the new assignment.
4. **Return the fresh record**: The caller gets the updated entry rather than the stale reference.

### Entry::Service#assign

```ruby
def assign(id, assignee_id, note: nil)
  entry = entries.find!(id)

  auth_context.can!(:assign, entry)

  repo.transaction do
    entries.update(id, assigned_user_id: assignee_id)
    assignment_log.create!(entry_id: id, from: entry.assigned_user_id,
                           to: assignee_id, note: note)
  end

  # Return updated entry
  entries.find!(id)
end
```

Note the explicit `can!` guard before the transaction — authorization failure should fail fast without touching the database.

## Key Patterns

### Single Responsibility Methods

Each service method should perform exactly one business operation. If you find yourself naming a method `create_and_notify_and_log`, split it:

```ruby
# Good
def create(attrs)
  account = repo.transaction { repo.create(attrs) }
  notify_account_created(account)
  account
end

# Bad
def create_and_notify_and_log(attrs)
  # ...
end
```

### Return Record Objects

Services always return domain records (instances of `Sequel::Model` or Verse record types). The exposition layer handles serialization to JSON:API. Never return hashes, raw SQL rows, or pre-serialized JSON from a service method.

```ruby
# Good
def find(id)
  accounts.find!(id)
end

# Bad
def find_as_json(id)
  accounts.find!(id).to_json
end
```

### Descriptive Method Names

Method names should match the domain language used by product managers, documentation, and the frontend team:

| Domain Term | Service Method |
|-------------|---------------|
| Submit an entry | `submit(id, opts)` |
| Assign a reviewer | `assign(id, reviewer_id, note:)` |
| Select an annotation | `select(entry_id, annotation_id)` |
| Flag an error | `error(entry_id, reason:)` |
| Lock a dataset | `lock(dataset_id)` |
| Reject a submission | `reject(id, reason:)` |

### Avoid Service-to-Service Calls

Services never instantiate or call methods on another service class. Cross-domain logic goes through the inter-service HTTP API or an event. This prevents circular dependencies and keeps service boundaries explicit.

### Idempotency Where Possible

Write service methods so they can be safely retried. Use database unique constraints and `ON CONFLICT DO NOTHING` / `ON CONFLICT DO UPDATE` (via Sequel's `insert_conflict`) to handle duplicate operations gracefully:

```ruby
def add_member(team_id, account_id, role: "member")
  repo.transaction do
    membership = team_memberships.create(team_id:, account_id:, role:)
    membership
  end
rescue Sequel::UniqueConstraintViolation
  # Already a member — treat as success
  team_memberships.find_by(team_id:, account_id:)
end
```

### Testing Services

Services are unit-tested with RSpec. The test pattern is:

1. Create test data in the database (via factories or `spec_data` fixtures).
2. Instantiate the service with a mock or real auth context.
3. Call the method and assert on the returned record or side effects.

```ruby
RSpec.describe Account::Service do
  let(:auth_context) { AuthContext.new(account_id: account.id, role: "admin") }
  let(:service) { described_class.new(auth_context) }

  describe "#create" do
    it "creates an account with valid params" do
      result = service.create(email: "new@example.com", name: "New User")
      expect(result).to be_persisted
      expect(result.email).to eq("new@example.com")
    end
  end
end
```

See the [Testing guide](testing.md) for full details on test setup and conventions.

## Summary Checklist

When implementing a new service method, verify the following:

- [ ] Does it use `use_repo` for auth-scoped repositories and `use_system_repo` only when scoping must be bypassed?
- [ ] Does it guard authorization with `can!` or `can?` before mutating data?
- [ ] Does it wrap multi-repository writes in a `repo.transaction` block?
- [ ] Does it raise domain errors (`Verse::Error::*`) rather than returning error flags or `nil`?
- [ ] Does it return a record object (not a hash, JSON string, or primitive)?
- [ ] Does the method name match the domain language?
- [ ] Is it idempotent or safely retryable?
- [ ] Does it avoid calling other services directly?
