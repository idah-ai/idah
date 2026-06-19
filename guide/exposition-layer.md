# Exposition Layer

## Role

The Exposition Layer is the **entry point** for all external interactions into a Verse service. It handles:

- **HTTP routing** — mapping URL paths and HTTP methods to Ruby methods
- **Event subscription** — listening to resource events (CRUD) and custom channel events
- **Input validation** — declaring and coercing params via Verse's declarative schema DSL
- **Output rendering** — returning JSON:API-compliant responses

It is a **thin layer** — no business logic lives here. Every public method on an exposition delegates immediately to a service object. This keeps expositions easy to test, easy to reason about, and safe to refactor.

### What does NOT belong here

- Complex conditionals or branching based on application state
- Database queries or repository calls directly
- Transformation or enrichment of data beyond what the renderer handles

If you find yourself writing anything more than a one-liner delegation in an exposition method, that logic belongs in a service or a utility.

---

## Base Class Pattern

Every exposition inherits from `BaseExpo`, which configures the JSON:API renderer:

```ruby
class BaseExpo < Verse::Exposition::Base
  def self.inherited(klass)
    super
    klass.renderer Verse::JsonApi::Renderer
  end
end
```

The `inherited` hook ensures that any subclass automatically gets `Verse::JsonApi::Renderer` without needing to repeat the declaration. This means all responses are JSON:API-compliant (`Content-Type: application/vnd.api+json`) by default.

Each service defines its own `BaseExpo` in `app/expo/base_expo.rb`:

```
app/<service>/
  expo/
    base_expo.rb       ← sets the JSON:API renderer
    healthcheck_expo.rb
    accounts_expo.rb
    ...
```

---

## Registration

All expositions must be **explicitly registered** at boot time. This is done in `config/routes.rb`:

```ruby
Verse.on_boot do
  [
    HealthcheckExpo,
    AccountsExpo,
    ApiKeysExpo,
    SessionsExpo,
  ].each(&:register)
end
```

Only expositions listed here will receive HTTP routes or event subscriptions. This explicit registration keeps the boot process predictable and avoids
magical auto-discovery.

For expositions that listen to events only (no HTTP endpoints), they are still registered the same way — the `on_event` and `on_resource_event` declarations
inside them wire up the subscriptions automatically.

---

## HTTP Endpoints

### Declarative CRUD (`json_api` block)

For standard RESTful CRUD operations against a model, use the `json_api` block:

```ruby
class AccountsExpo < BaseExpo
  http_path "/accounts"
  use_service Account::Service

  json_api Account::Record do
    index do
      allowed_filters :name__match, :email, :enabled
      blacklist_filters :hashed_password
    end
    show
    create
    update
    delete
  end
end
```

| Directive | HTTP Method | Path | Description |
|-----------|-------------|------|-------------|
| `index` | `GET` | `/accounts` | List resources with pagination, filtering, sorting |
| `show` | `GET` | `/accounts/:id` | Fetch a single resource by ID |
| `create` | `POST` | `/accounts` | Create a new resource |
| `update` | `PATCH` | `/accounts/:id` | Update an existing resource |
| `delete` | `DELETE` | `/accounts/:id` | Delete a resource |

Within `index`, you can declare:

- **`allowed_filters`** — whitelist of filterable fields (e.g. `:name__match`, `:email`). The `__match` suffix tells the repository to use a LIKE/ILIKE search.
- **`blacklist_filters`** — fields that must never be filterable (e.g. secrets).

Each CRUD action maps to a corresponding method on the injected service (e.g. `index` → `service.index(...)`, `show` → `service.show(...)`).

You can also override any CRUD action's behaviour by defining a matching method, if you need to customise the response:

```ruby
json_api Account::Record do
  create
end

# override to add metadata
def create
  account = super
  renderer.meta = { verification_email_sent: true }
  account
end
```

---

### Custom Endpoints

When CRUD doesn't fit (e.g. actions, joins, tokens), define custom HTTP endpoints:

```ruby
expose on_http(:patch, "/:token/join", auth: nil) do
  desc "Mark account as joined"
  input do
    field :token, String
  end
end
def join
  account, reset_token = service.mark_as_joined(params[:token])
  renderer.meta = { password_reset_token: reset_token }
  account
end
```

Key elements:

| Element | Description |
|---------|-------------|
| `on_http(:patch, "/:token/join", auth: nil)` | Declares HTTP method, path, and auth scope. `auth: nil` means publicly accessible. |
| `desc` | Human-readable description (used in auto-generated docs). |
| `input do ... end` | Declares required and optional params with type coercion. |
| `params` | Hash of parsed/coerced input values available inside the method body. |
| `renderer.meta` | Sets top-level JSON:API `meta` key. |

---

### Custom Output Schemas

You can also declare an `output` schema to document and validate the response shape:

```ruby
expose on_http(:get, "/permissions(/:scope_type)?") do
  input do
    field?(:scope_type, [String, NilClass]).transform { |v| v || "all" }
  end
  output Verse::JsonApi::Util.jsonapi_record(ApiPermission::Record)
end
def permissions
  service.list_permissions(params[:scope_type])
end
```

- **`output`** declares the response type for documentation and client generation.
- **`field?`** (with a question mark) declares an **optional** parameter.
- **`.transform`** allows default-value coercion at the param level.
- **Route path groups** like `(/:scope_type)?` make segments optional in the URL.

---

### JSON-RPC Endpoints (for annotations)

Annotation mutations use a single JSON-RPC endpoint instead of HTTP verbs. This is configured with `json_rpc`:

```ruby
class AnnotationsExpo < BaseExpo
  json_rpc http_path: "_rpc", batch_limit: 50, batch_failure: :stop
```

| Option | Description |
|--------|-------------|
| `http_path` | Path suffix relative to the exposition's `http_path`. Full path would be `/annotations/_rpc`. |
| `batch_limit` | Maximum number of RPC calls in a single request (defaults to 50). |
| `batch_failure` | `:stop` aborts remaining calls on failure, `:continue` processes all. |

Individual RPC methods are defined with `json_rpc_method`:

```ruby
expose json_rpc_method(:show)
def rpc_show
  service.show(params[:id])
end

expose json_rpc_method(:update)
def rpc_update
  service.update(params[:id], params[:attributes])
end

expose json_rpc_method(:delete)
def rpc_delete
  service.delete(params[:id])
end
```

Each RPC method:

- Receives a `params` hash from the JSON-RPC payload.
- Must return a value (or raise) that Verse serialises back as the JSON-RPC result.
- Method names follow the convention `rpc_<name>` to match the `json_rpc_method(:<name>)` declaration.

JSON-RPC is preferred for annotation mutations because it reduces round-trips and allows atomic-like batch processing.

---

## Event Handlers

### Resource Events (CRUD-based)

Resource events fire automatically when a repository creates, updates, or deletes a record. Expositions subscribe using `on_resource_event`:

```ruby
expose on_resource_event(Resource::Iam::Accounts, "created")
def on_account_created
  service.create_default_settings(message.content[:resource_id])
end
```

| Parameter | Description |
|-----------|-------------|
| `Resource::Iam::Accounts` | The resource constant (also doubles as the JSON:API type and event channel name). |
| `"created"` | Event type: `"created"`, `"updated"`, or `"deleted"`. |

The `message` object provides:

- `message.content[:resource_id]` — UUID of the affected resource.
- `message.content[:data]` — Full payload (if the repository published additional data).

These handlers run asynchronously in the event subscriber. They are ideal for side effects: creating default settings, sending notifications, invalidating caches, etc.

---

### Custom Events

For non-resource events (e.g. email sending, job completion), subscribe to custom named channels:

```ruby
expose on_event(Service::Notification::SEND_EMAIL_CHANNEL)
def on_send_email
  notify = Verse::JsonApi::Struct.new(message.content)
  service.send_email(notify.account_email, notify)
end
```

The channel is typically a string constant defined in the publishing service. `Verse::JsonApi::Struct` provides hash-access with symbol/string indifference for the payload.

---

### Scheduled Endpoints (Cron)

Expositions can declare scheduled (cron) jobs that run at defined intervals:

```ruby
expose on_schedule("15 0 * * *")
def expire_api_keys
  service.expire_api_keys
end
```

The schedule string is a standard cron expression (`minute hour day month weekday`). Scheduled methods:

- Receive no `params` or `message` — they are purely time-triggered.
- Execute inside the service's authed context (typically a system-level context).
- Are ideal for periodic cleanup, expiry, and maintenance tasks.

---

## Key Patterns

### `use_service ServiceClass`

Injects a service instance into the exposition. The service is available via the `service` method:

```ruby
class AccountsExpo < BaseExpo
  http_path "/accounts"
  use_service Account::Service  # ← injection

  json_api Account::Record do
    show
  end
  # service.show(id) is called automatically on GET /accounts/:id
end
```

The service instance is scoped to the request/event context and may have access to the current auth context.

### `renderer.meta = { ... }`

Sets top-level metadata on the JSON:API response:

```ruby
renderer.meta = { password_reset_token: reset_token }
```

This renders as:

```json
{
  "meta": { "password_reset_token": "abc123" },
  "data": { ... }
}
```

Use `meta` for extra response data that doesn't fit the resource shape (tokens, counts, warnings).

### `params` hash

The `params` hash is available inside every exposed method. It contains:

- For HTTP endpoints: parsed and coerced query params + path params + body params.
- For event handlers: the event message content (accessible directly via `params` or `message.content`).
- For JSON-RPC methods: the RPC params hash.

Params are declared in the `input` block and coerced to the declared types.

### Error propagation

Errors raised in the service layer propagate up to the exposition automatically. Verse maps these to appropriate HTTP status codes:

```ruby
# In service:
raise Verse::Error::RecordNotFound, resource_id: id

# Results in: 404 Not Found, JSON:API error document
raise Verse::Error::Unauthorized

# Results in: 401 Unauthorized, JSON:API error document
```

Common Verse error classes:

| Error | HTTP Status |
|-------|-------------|
| `Verse::Error::RecordNotFound` | 404 |
| `Verse::Error::Unauthorized` | 401 |
| `Verse::Error::Forbidden` | 403 |
| `Verse::Error::ValidationFailed` | 422 |
| `Verse::Error::InvalidInput` | 400 |

### `auth: nil` on endpoints

Adding `auth: nil` to an `on_http` declaration makes the endpoint publicly accessible (no authentication required):

```ruby
expose on_http(:post, "/reset_password", auth: nil) do
  input do
    field :email, String
  end
end
```

Use this sparingly — only for endpoints that must be reachable before authentication (login, registration, password reset, health checks).

### Route path syntax

Route paths support:

- **Named segments**: `/:token/join` captures a `token` param from the URL.
- **Optional groups**: `/permissions(/:scope_type)?` makes the `/:scope_type` segment optional. The parentheses denote the group; the `?` suffix denotes optionality.

Multiple optional groups are supported, but keep routes simple to avoid ambiguity.

### Required vs optional fields

- `field :name, Type` — **required** param. Will raise if missing.
- `field? :name, Type` — **optional** param. Defaults to `nil` if not provided.
- `.transform` — post-coercion transformation (e.g. supplying a default value):

```ruby
field?(:scope_type, [String, NilClass]).transform { |v| v || "all" }
```

### Method naming conventions

| Endpoint declaration | Method name |
|----------------------|-------------|
| Inside `json_api` CRUD block | `index`, `show`, `create`, `update`, `delete` |
| `on_http(:get, "/foo")` | `foo` (derived from the path) |
| `json_rpc_method(:do_thing)` | `rpc_do_thing` |
| `on_resource_event(...)` | `on_<resource>_<event>` (convention, not enforced) |
| `on_schedule("...")` | Descriptive name like `expire_api_keys` |

---

## Summary

| Aspect | Pattern |
|--------|---------|
| **Base class** | `BaseExpo < Verse::Exposition::Base` with JSON:API renderer |
| **Registration** | Explicit list in `config/routes.rb` via `Verse.on_boot` |
| **CRUD** | `json_api Model::Record` block with `index`/`show`/`create`/`update`/`delete` |
| **Custom actions** | `expose on_http(:method, "/path")` with `input` block |
| **RPC** | `json_rpc` config + `expose json_rpc_method(:name)` |
| **Resource events** | `expose on_resource_event(Resource::Svc::Entity, "event")` |
| **Custom events** | `expose on_event(ChannelName)` |
| **Cron** | `expose on_schedule("cron expression")` |
| **Delegation** | All methods delegate to `service.method_name` |
| **No business logic** | Expositions are thin — logic lives in services |
