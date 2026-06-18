# Auth & Authorization

## Overview

IDAH implements two complementary security systems:

- **Authentication** — verifying *who you are* (identity). Handled by the **IAM service** via JWT tokens (password login) or API keys (machine-to-machine).
- **Authorization** — verifying *what you can do* (permissions). A **role-based access control (RBAC)** system where every repository query is scoped through `auth_context.can!()`.

The two systems converge at the **JWT payload**, which carries the user's role name, role scope, and role rights. Every service decodes this JWT on each request and uses it to filter database access.

---

## Authentication Flow

### Password Login

```
Frontend                         IAM Service
   │                                  │
   │  POST /auth/login                │
   │  { email, password, cookie:true }│
   │ ───────────────────────────────> │
   │                                  │
   │      │ Account::Repository.login(email, password)
   │      │   → BCrypt.verify(password, hashed_password)
   │      │   → event(:logged_in) published
   │      │
   │      │ Auth::Service.build_tokens(account)
   │      │   → JWT encode: { id, email, name, role_name, role_scope, exp }
   │      │   → RefreshToken.encode: { uid, sid, nc, refid, sub:"ort", exp }
   │      │
   │  <───────────────────────────────│
   │  JSON:API response               │
   │  meta.token = JWT                │
   │  Set-Cookie: auth-token=<JWT>    │
   │  Set-Cookie: refresh-token=<JWT> │
```

1. The frontend sends `POST /api/v1/iam/auth` with `email` and `password`.
2. `Auth::Service.login` calls `Account::Repository.login(email, password)` which verifies the password against the BCrypt hash stored in `accounts.hashed_password`.
3. If credentials are valid, `build_tokens` generates two JWTs:
   - **Auth token** — short-lived (24h), carries identity + role data.
   - **Refresh token** — long-lived (14 days), stored in the `account_sessions` table for rotation/revocation.
4. The auth token is placed in the response `meta.token` field (JSON:API convention) and optionally set as an `auth-token` cookie.
5. The frontend reads `meta.token` from the response body and stores it in `AuthContext`. The refresh token is set as an `http-only`, `secure` cookie at path `/api/v1/iam` (so only the IAM service can read it).

**Key implementation files:**

| File | Purpose |
|------|---------|
| `app/iam/app/expo/auth/simple_expo.rb` | HTTP exposition (`POST /auth`, `GET /auth/logout`, `GET /auth/refresh`) |
| `app/iam/app/expo/auth/helper_methods.rb` | Cookie management (`set_cookies`, `auth_cookie`, `refresh_cookie`) |
| `app/iam/app/service/auth/service.rb` | Core login, token building, refresh, logout logic |
| `app/iam/app/model/account.rb` | `Account::Repository.login` with BCrypt verification |
| `app/iam/app/service/refresh_token.rb` | Refresh token encode/validate with seq check |

### JWT Structure

Tokens are **signed with ES256 (ECDSA using P-256 and SHA-256)** via `Verse::Http::Auth::Token.encode`:

```ruby
auth_token = Verse::Http::Auth::Token.encode(
  {
    id: account.id,
    email: account.email,
    name: account.name,
  }.compact,
  account_role,       # e.g. "admin", "org_owner", "user"
  account.role_scope, # e.g. { org: ["org-uuid"], project: ["proj-uuid"] }
  exp: Time.now.to_i + AUTH_TOKEN_LIFETIME  # 86_400 (24h)
)
```

**JWT payload:**
```json
{
  "id": "018e3c3e-...",
  "email": "alice@example.com",
  "name": "Alice Johnson",
  "role_name": "org_owner",
  "role_scope": { "org": ["018e3c3f-..."] },
  "role_rights": ["dataset:projects.*.as_org_owner", "iam:accounts.read.as_org_owner", "..." ],
  "exp": 1740000000
}
```

The signing key is loaded from the `SERVICE_JWT_KEY` environment variable (PEM-encoded EC P-256 private key). Each service loads this key in `config/initializers/set_keys.rb`:

```ruby
key = OpenSSL::PKey::EC.new(key_content)
Verse::Http::Auth::Token.sign_key = key
```

Services can use a *public key* to validate tokens without being able to forge them. This is intentional — the IAM service is the only issuer.

### Token Refresh

The refresh flow extends sessions without requiring re-authentication:

```
GET /auth/refresh
Cookie: refresh-token=<JWT>
```

1. `Auth::Service.refresh_token` decodes the refresh JWT.
2. Extracts `uid` (account ID), `sid` (session ID), `nc` (nonce), `refid` (sequence ID).
3. Validates the sequence ID matches the current session seq in `account_sessions` — this detects token reuse/rotation attacks.
4. Calls `account_sessions.bump_refresh_seq` to increment the sequence counter (invalidating any previous refresh token from the same session).
5. Issues a new auth token and a new refresh token.

Refresh tokens use a dedicated JWT format with `sub: "ort"` (one-time-use refresh token) to distinguish them from auth tokens:

```ruby
JWT.encode(
  { uid: account_id, sid: session_id, nc: nonce, refid: seq_id, sub: "ort", exp: },
  Verse::Http::Auth::Token.sign_key,
  Verse::Http::Auth::Token.sign_algorithm
)
```

### API Key Authentication

API keys enable machine-to-machine and external API access without a user session.

```
POST /auth/api/login
{ api_key: "IDAH_..." }
```

**The flow:**

1. Client sends the API key (format: `IDAH_` prefix, 69 characters total) to the IAM exposition `Auth::ApiExpo` at `/auth/api/login`.
2. `Auth::Service.login_api` computes `Digest::SHA256.hexdigest(key)` and looks up the key in `api_keys` table. Only the SHA-256 hash is stored server-side (the raw key is shown once at creation).
3. Validates: key exists → not expired → not revoked → status is `active`.
4. Fetches the `service_account` (belongs_to association) — API keys are linked to an IAM account.
5. Calls `api_key.build_scope` to determine the scope hash (`{ org: [...] }`, `{ project: [...] }`, or `{}` for `all`).
6. Generates a compound role string: `"api:#{permissions.join(",")}"` (e.g., `"api:org_ro_org,project_rw_org"`).
7. Encodes a JWT with `labels: ["api"]` to distinguish API-authenticated requests from user-authenticated ones.
8. Resolves the compound role's rights by loading sub-roles from `api_scopes/*.yml` via `RoleRepository.chunked_index`.
9. Returns an `AccountAuth::Record` with the token, rights, and scope.

**Key implementation files:**

| File | Purpose |
|------|---------|
| `app/iam/app/expo/auth/api_expo.rb` | HTTP exposition (`POST /auth/api/login`) |
| `app/iam/app/service/auth/service.rb` (`login_api`) | Key validation, scope building, compound role generation |
| `app/iam/app/model/api_key.rb` | `Record`, `Repository`, `build_scope` |

---

## Authorization Model

### Roles

Roles are defined as YAML files in `common/data/roles/` with a **version-prefixed filename** (`<major.minor.patch>_<name>.yml`). The prefix determines role precedence but is not the primary mask — the `mask` field inside the YAML is the actual authority weight.

| File | Role Name | Assignable | mask | Description |
|------|-----------|------------|------|-------------|
| `0.0.0_anonymous.yml` | `anonymous` | No | `0.0.0` | Unauthenticated users (login/join only) |
| `1.0.0_user.yml` | `user` | Yes | `1.0.0` | Registered users with project-level access |
| `2.0.0_org_owner.yml` | `org_owner` | Yes | `2.0.0` | Organization owners, full org-scoped access |
| `8.0.0_admin.yml` | `admin` | Yes | `8.0.0` | System administrators, cross-org access |
| `9.9.9_system.yml` | `system` | No | `9.9.9` | Internal system (unrestricted `*.*.*`) |
| `api_scopes/*.yml` | `api/*` | No | varies | API key sub-roles for compound resolution |

**YAML structure:**

```yaml
# common/data/roles/2.0.0_org_owner.yml
org_owner:
  mask: "2.0.0"
  description: |
    This role is assigned to organization owners
    who have access to all projects within their organization.
  assignable: true
  rights:
    - "iam:accounts.login.*"
    - "iam:accounts.read.as_org_owner"
    - "dataset:projects.*.as_org_owner"
    - "dataset:entries.*.as_org_owner"
    # ...
```

Roles are loaded at boot by `RoleRepository.load`:

```ruby
Dir.glob("#{ROLE_PATH}/**/*.yml").each do |file|
  next if file =~ /templates/  # skip template files
  repo.load_role(YAML.safe_load(File.read(file)))
end
```

The `RoleRepository` is an in-memory repository (stored as module-level class data), not a database table. It implements `unfold_rights` and `find_template` to support the template system.

### Permission String Format

Permissions follow a strict 3-part dot-separated format:

```
<service>:<entity>.<action>.<scope>
```

| Component | Values | Description |
|-----------|--------|-------------|
| `service` | `iam`, `dataset`, `media`, `setting`, `sync` | The logical service domain |
| `entity` | `accounts`, `projects`, `entries`, `annotations`, `datasets`, `note_feeds`, `note_comments`, `entry_stats`, `project_members`, `api_keys`, `organizations`, `medias`, `jobs`, `exports`, `settings`, `account_settings`, `plugins` | The resource type (matches `Resource::Service::Entity` constants) |
| `action` | `create`, `read`, `update`, `delete`, `login`, `logout`, `*` (wildcard) | The operation |
| `scope` | `own`, `as_user`, `as_org_owner`, `*` (wildcard), `{org_ro_org,project_rw_org}` (compound) | The visibility boundary |

**Examples:**

| Permission | Meaning |
|-----------|---------|
| `iam:accounts.login.*` | Anyone can call the login endpoint |
| `iam:accounts.update.own` | User can update only their own account record |
| `dataset:projects.*.as_user` | User can CRUD projects they are a member of |
| `dataset:annotations.*.as_org_owner` | Org owner can CRUD all annotations in their org |
| `dataset:entries.read.as_user` | User can read entries they have project membership for |
| `dataset:projects.*.*` | Admin can CRUD all projects (wildcard scope) |
| `*.*.*` | System role: unrestricted access to everything |
| `iam:api_keys.create.{org_ro_org,project_rw_org}` | Compound scope for API key creation |

### Template System

YAML files in `common/data/roles/templates/` define reusable sets of rights that can be referenced via `$` prefix:

```yaml
# templates/resource_crud.yml
resources:
  - "dataset:projects.*.as_org_owner"
  - "dataset:datasets.*.as_org_owner"
```

Referenced in role files:
```yaml
rights:
  - "$resource_crud"
```

The `$` prefix triggers `RoleRepository.unfold_rights`, which looks up the template and inlines its rights. This avoids duplication when the same pattern appears across multiple roles.

> **Note:** Template files are excluded from `RoleRepository.load` via `next if file =~ /templates/`. They are only resolved when `unfold_rights` is called with a `$`-prefixed entry.

### Compound Scopes

For API keys, scopes can be compound using curly-brace syntax:

```yaml
- "iam:api_keys.create.{org_ro_org,project_rw_org}"
```

When `RoleBackend.fetch` encounters a role name with a `:` separator (e.g., `"api:org_ro_org,project_rw_org"`), it:
1. Splits on `:` → main role (`api`) and sub-role scopes (`org_ro_org, project_rw_org`).
2. Loads the main role's rights from the in-memory repository.
3. For each sub-scope, loads `api/<scope>` from `api_scopes/*.yml` (e.g., `api_scopes/9.0.1_org_ro_org.yml`).
4. Sums all rights arrays together.
5. Deduplicates by resource+action prefix, keeping the last match (which has the more specific scope).

This allows API keys to have fine-grained, composable permission profiles.

**Common rights** (from `api_scopes/0.0.0_common.yml`):
```yaml
api:
  rights:
    - "iam:accounts.read.own"
```
These are always included in every API key's effective rights.

### Resource Constants

Every service defines resource constants in `common/lib/resource/<service>.rb`. These serve triple duty:
1. **JSON:API type identifiers** (the `type` field in request/response bodies).
2. **Authorization resource names** (matched against permission strings).
3. **Event channel names** (used in `on_resource_event` subscriptions).

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

# common/lib/resource/dataset.rb
module Resource
  module Dataset
    Projects = "dataset:projects"
    ProjectMembers = "dataset:project_members"
    Datasets = "dataset:datasets"
    Entries = "dataset:entries"
    Annotations = "dataset:annotations"
    NoteFeeds = "dataset:note_feeds"
    NoteComments = "dataset:note_comments"
    EntryStats = "dataset:entry_stats"
  end
end
```

Services covered: `Resource::IAM`, `Resource::Dataset`, `Resource::Media`, `Resource::Audit`, `Resource::Setting`, `Resource::Sync`.

---

## Repository Scoping

The central authorization mechanism is each repository's `scoped(action)` method. This is where the abstract RBAC permission model meets the concrete database query.

### How `auth_context.can!` Works

Every repository receives an `auth_context` (injected by Verse). When a service calls a repository method, the repository passes the requested `action` and a resource constant to `can!`:

```ruby
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }                                         # admin/system: full access

    scope.as_org_owner? do |org_ids|                             # org owner: org-scoped
      table.where(organization_id: org_ids)
    end

    scope.as_user? do |account_id|                                # user: own records
      table.where(assigned_to: account_id)
    end

    scope.own { table.where(id: auth_context.metadata[:id]) }    # personal records only
  end
end
```

**The resolution algorithm:**

1. `auth_context.can!` looks up the user's role rights from the JWT payload (`role_rights` array).
2. It checks if the role has any matching right for the requested `action` on the `resource`.
3. If a match exists, it evaluates the `scope` block — the `scope` object yields callbacks matching the right's scope segment (e.g., `as_user`, `as_org_owner`, `own`, `all`).
4. Each matching callback returns a dataset (Sequel query) that is **intersected** (AND-ed) with any others.
5. If no right matches at all, it raises `Verse::Error::Authorization` (HTTP 403).

### Real-World Example: Entry Repository

From `app/dataset/app/model/entry.rb`:

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

def user_project_scoped_query(action)
  return table if action == :create

  account_id = auth_context.metadata[:id]

  case action
  when :read, :submit
    # EXISTS( SELECT 1 FROM project_members pm
    #         WHERE pm.account_id = :account_id
    #           AND pm.project_id = entries.project_id
    #           AND pm.disabled_at IS NULL )
    scoped_fragment = <<-SQL
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.account_id = :account_id
          AND pm.project_id = entries.project_id
          AND pm.disabled_at IS NULL
      )
    SQL
    table.where(Sequel.lit(scoped_fragment, account_id:))
  when :update, :delete
    # Filters further by project member role (annotator/reviewer)
    # ...
  end
end
```

### Scope Callback Reference

| Callback | Matches Right Scope | When to Use |
|----------|---------------------|-------------|
| `scope.all? { ... }` | `*` (wildcard) | Admin/system full table access — returns the table dataset unfiltered |
| `scope.as_org_owner? { ... }` | `as_org_owner` | Organization-scoped access — filter by org membership; `auth_context.custom_scopes[:org]` contains the user's org IDs |
| `scope.as_user? { ... }` | `as_user` | User-scoped access — filter by project membership or ownership; `auth_context.metadata[:id]` is the current user's ID |
| `scope.own { ... }` | `own` | Personal records only (account settings, own account) |
| `scope.array? { ... }` | `{...}` (compound) | Used for API key create scopes — validates the scope array is acceptable |

### `auth_context.custom_scopes`

The `custom_scopes` hash is populated from the JWT's `role_scope` field. It contains pre-computed scoping IDs:

```ruby
auth_context.custom_scopes[:org]     # => ["org-uuid-1", "org-uuid-2"]  (nil if org-wide)
auth_context.custom_scopes[:project] # => ["proj-uuid-1"]               (nil if project-wide)
```

For org owners, this typically contains their organization's UUID. For user roles, it may include project IDs they are members of.

---

## System Repos vs User Repos

Verse repositories can use one of two repo types:

```ruby
# Scoped repos — user authorization is applied
use_repo \
  accounts: Account::Repository,
  account_sessions: AccountSession::Repository

# System repos — bypass auth scoping entirely
use_system_repo \
  system_accounts: Account::Repository,
  system_account_sessions: AccountSession::Repository
```

| Repo Type | Method Prefix | Scoping | Use Case |
|-----------|---------------|---------|----------|
| `use_repo` | `accounts.find(...)` | `scoped(action)` applied | Normal CRUD operations |
| `use_system_repo` | `system_accounts.find(...)` | No scoping — `table.all` | Workflow transitions, admin operations, system tasks |

**When to use system repos:**

| Scenario | Why System Repo? |
|----------|-----------------|
| Workflow transition reassigns an entry to another user | The original submitter may no longer have `:write` access to the entry, but the service still needs to mark the dataset as needing progress update |
| Admin creates a scoped token for a different org member | The admin's auth context scopes to their own resources, but they need to operate on behalf of another user |
| Login/refresh token validation | No authenticated user exists yet — the token validation happens before auth context is established |
| Password reset flows | The user is not yet authenticated |
| System-level batch operations (e.g., nightly cleanup) | No meaningful "current user" exists |

**Example — system repo in auth service:**
```ruby
use_system_repo \
  system_accounts: Account::Repository,
  system_account_sessions: AccountSession::Repository,
  system_roles: RoleRepository,
  system_api_keys: ApiKey::Repository
```

The `system_*` prefix is a conventional naming pattern, not enforced by the framework. Choose clear names that indicate the repo bypasses auth.

---

## Frontend Auth

### AuthContext (Singleton)

The frontend's auth state is managed by the `AuthContext` class (singleton pattern) and consumed via the `authStatus` Svelte writable store.

**File:** `frontend/src/lib/security/AuthContext.ts`

```typescript
export type AuthenticationStatus = {
  status: "loading" | "logged-in" | "logged-out";
  authContext: AuthContext | null;
};

export const authStatus: Writable<AuthenticationStatus> = writable({
  status: "loading",
  authContext: null,
});
```

**Initialization flow:**

1. App starts → `AuthenticationStatus.svelte` mounts.
2. On mount, it calls `AuthContext.refresh()`.
3. `refresh()` sends `GET /auth/refresh` (browser sends the `refresh-token` cookie automatically).
4. On success, decodes the response into an `AuthContext` instance, sets status to `logged-in`.
5. On failure, sets status to `logged-out` (redirects to `/login`).

**AuthContext class properties:**
```typescript
class AuthContext {
  public readonly id: string;
  public readonly email: string;
  public readonly name: string | null;
  public readonly pictureUrl: string | null;
  public readonly roleName: Role;
  public readonly roleScope: Hash;
  public readonly roleRights: string[];
  public readonly exp: number;

  // Permission check
  public async can(
    action: Action,
    resource: Resource,
    scopes?: Scope[]
  ): Promise<boolean>;
}
```

**Static methods:**
| Method | Purpose |
|--------|---------|
| `AuthContext.signInWithEmailAndPassword(email, password)` | Login → stores JWT in singleton |
| `AuthContext.refresh()` | Refresh JWT via cookie-based refresh token |
| `AuthContext.logout()` | Clear session, redirect to `/login` |

### ActionMap (Trie-based Right Lookup)

`ActionMap` converts the flat `roleRights` array into a nested map for O(1) permission lookups:

**File:** `frontend/src/lib/security/ActionMap.ts`

```typescript
// Raw rights: ["dataset:projects.*.as_user", "dataset:entries.read.as_user"]
// Becomes:
{
  "dataset:projects": { "*": ["as_user"] },
  "dataset:entries": { "read": ["as_user"] }
}

// Lookup:
actionMap.get("read", "dataset:entries"); // => ["as_user"]
```

If a resource or action is not found, it falls back to checking for `"*"` wildcard entries (admin/system roles have `"*.*.*"` which maps to `map["*"]["*"]`).

The `can()` method checks:
1. `hasScope(action, resource)` — exact match from ActionMap.
2. If `scope` is a plain string (e.g., `"as_user"`), checks scopes include it.
3. If `scope` is an object with `{ as_user: { projectId, projectMemberRoles } }`, it queries `project_members` to check the user's project-level role (annotator/reviewer).

### PageProvider

`PageProvider` is a Svelte component that wraps protected routes and performs authorization before rendering.

**File:** `frontend/src/lib/components/app/page/page-provider.svelte`

```svelte
<PageProvider
  name="entry-view"
  action="read"
  resource="dataset:entries"
  scopes={[{ as_user: { projectId, projectMemberRoles: ["annotator", "reviewer"] } }]}
>
  <!-- Protected content -->
</PageProvider>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Page identifier |
| `action` | `Action` | Required action (`create`, `read`, `update`, `delete`) |
| `resource` | `Resource` | Resource type constant |
| `scopes` | `Scope[]` (optional) | Required scopes |
| `roles` | `Role[]` (optional) | Alternative role-based check |
| `redirectTo` | `string` | Fallback redirect on access denied |

**Authorization check:**
```typescript
async function checkAccess() {
  const currentAccount = $authStatus.authContext;
  if (!currentAccount) return;

  let result = await currentAccount.can(action, resource, scopes);

  if (roles) {
    result = roles.includes(currentAccount.roleName);
  }

  return result;
}
```

### TypeScript Types

**File:** `frontend/src/lib/security/types.ts`

```typescript
export type Action = "login" | "logout" | "create" | "read" | "update" | "delete";
export type Resource = "iam:accounts" | "iam:organizations" | "dataset:projects" | "dataset:entries" | ...;
export type Scope = "as_user" | "as_org_owner" | { as_user: ProjectMemberScope };

export type ProjectMemberScope = {
  projectId: string;
  projectMemberRoles: ("annotator" | "reviewer")[];
};
```

---

## Service Accounts

Services communicate with each other via the internal API client (`common/lib/api.rb`). Each service has credentials configured in its `config/config.yml`:

```yaml
credentials:
  account: "media-service@idah.local"
  password: "s3cret!"
```

**Token generation flow** (`common/lib/api/__map__/__include__.rb`):

```ruby
def generate_token
  # Reuse existing token if still valid (60s buffer)
  if @service_token && @service_token_expires_at &&
     (@service_token_expires_at - Time.now.to_i) >= 60
    return @service_token
  end

  # Login to IAM service
  output = Api[:idah].iam.auth.login(
    email: credentials.fetch(:account),
    password: credentials.fetch(:password)
  )

  token = output.meta[:token]
  @service_token_expires_at = decode_exp_from_jwt(token)
  @service_token = token
end
```

**Key points:**
- Each service account is a regular IAM account (with a role, likely `system` or `admin`).
- The login endpoint (`iam.auth.login`) intentionally **omits** the `auth: :bearer` option — there is no token yet on first call.
- All subsequent API calls use `options: { auth: :bearer }` to attach the `Authorization: Bearer <token>` header.
- The auth provider (`add_auth(:bearer)`) is registered globally and injects the JWT into every request that opts in.
- Tokens are cached with a **60-second buffer** before expiry to avoid re-logging on every call.

**Supported inter-service calls (via `Api[:idah]`):**

```
Api[:idah].iam.accounts.index(...)          # IAM → HTTP
Api[:idah].iam.auth.login(...)              # Login (no bearer)
Api[:idah].iam.organizations.index(...)     # IAM
Api[:idah].dataset.projects.index(...)      # Dataset
Api[:idah].media.medias.resource_info(...)  # Media
Api[:idah].media.medias.files(...)          # Media
```

---

## Summary: Request Lifecycle

```
HTTP Request
  │
  ├── [Nginx reverse proxy]
  │
  ├── Service loads JWT from cookie or Authorization header
  │   ├── Verse::Http::Auth::Token.decode (EC P-256 / ES256)
  │   └── AuthContext populated: metadata, custom_scopes, role_rights
  │
  ├── Exposition receives request
  │   └── Calls service method
  │
  ├── Service calls repository method
  │   └── Repository calls scoped(action)
  │       └── auth_context.can!(action, resource) do |scope|
  │           ├── matches right from role_rights
  │           ├── calls matching scope callback
  │           └── returns filtered Sequel dataset
  │
  ├── Sequel executes query with WHERE filters
  └── Response serialized (JSON:API)
```

## Authorization Flow Diagram

```mermaid
flowchart TD
    A[HTTP Request] --> B[Load JWT & Decode]
    B --> C[AuthContext built:\nmetadata, custom_scopes,\nrole_rights]
    C --> D[Service calls repo method]
    D --> E{Repository calls scoped(action)}
    E --> F[auth_context.can! checks role_rights]
    F --> G{Rights match?\naction + resource}
    G -->|No| H[Raise Verse::Error::Authorization]
    G -->|Yes| I{Evaluate scope callbacks}
    I --> J[scope.all? → full table access]
    I --> K[scope.as_org_owner? → filter by org]
    I --> L[scope.as_user? → filter by project membership]
    I --> M[scope.own → filter by account_id]
    J --> N[Intersect all matching scope queries]
    K --> N
    L --> N
    M --> N
    N --> O[Execute filtered Sequel query]
    O --> P[Return scoped results]
```

### Event-driven flows (auth context bypassed):

```mermaid
flowchart TD
    A[Redis pub/sub Event] --> B[Exposition event handler\n(on_resource_event)]
    B --> C[Service uses system repo\n(bypasses auth)]
    C --> D[Unfiltered DB operation]
    D --> E[Event published downstream]
```

---

## Related Documentation

| Guide | Link |
|-------|------|
| Verse Layered Architecture | [`verse-architecture.md`](verse-architecture.md) |
| Exposition Layer | [`exposition-layer.md`](exposition-layer.md) |
| Service Layer (Business Logic) | [`service-layer.md`](service-layer.md) |
| Model & Repository (Data Access) | [`model-repository.md`](model-repository.md) |
| Event System | [`event-system.md`](event-system.md) |
| Inter-Service API Client | [`inter-service-api.md`](inter-service-api.md) |
| IAM Service | [`service-iam.md`](service-iam.md) |
