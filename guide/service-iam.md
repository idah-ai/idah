# IAM Service

## Purpose

The **IAM (Identity & Access Management)** service is the authentication and authorization hub for IDAH. It manages:

- **Accounts** — user identities, roles, and invitation flows
- **Organizations** — tenant groupings for multi-org support
- **Authentication** — password login, JWT issuance, token refresh, logout
- **Sessions** — login session tracking with rotation-based security
- **API Keys** — machine-to-machine credentials with scoped permissions
- **Password Management** — reset, change, and token validation

Every other service in IDAH depends on IAM for authentication. The JWT issued by IAM is decoded by all downstream services to authorize requests and scope database access.

---

## Models

### Account::Record

Represents a user account. Defined in `app/model/account.rb`.

| Field | Type | Visibility | Notes |
|-------|------|-----------|-------|
| `id` | Integer | public | Primary key, auto-increment via `bigserial` |
| `name` | String | public | Display name |
| `email` | String | public (readonly) | Unique, indexed |
| `hashed_password` | String or Nil | **hidden** | BCrypt hash; never exposed in API responses |
| `password_reset_token` | String or Nil | **hidden** | SecureRandom hex token for password reset |
| `password_reset_token_expires_at` | Time or Nil | **hidden** | Reset token expiry (1 hour) |
| `sso_channel` | String or Nil | public (readonly) | SSO provider identifier (future use) |
| `enabled` | Boolean | public | Soft-disabled flag; `false` prevents login |
| `role_name` | String or Nil | public | Role identifier (e.g. `"admin"`, `"org_owner"`, `"user"`) |
| `role_scope` | Hash | public | JSONB scoping data (e.g. `{ org: ["org-uuid"] }`) |
| `picture_url` | String or Nil | public (readonly) | Avatar URL |
| `joined_at` | Time or Nil | public (readonly) | Set when user accepts invitation |
| `invitation_token` | String or Nil | public | Token for join-by-invitation flow |
| `invitation_expired_at` | Time or Nil | public (readonly) | Invitation expiry (3 days) |
| `created_at` | Time | public (readonly) | |
| `updated_at` | Time | public (readonly) | |

**Key method:** `password_match?(password)` — verifies a plaintext password against the stored BCrypt hash.

**Repository:** `Account::Repository` scopes queries via `auth_context.can!`. Provides a `login` method that includes a timing-attack mitigation delay (`sleep(rand(0.3..0.5))`) when the email is not found. Publishes `logged_in`, `created`, `updated`, and `deleted` resource events.

---

### AccountSession::Record

Tracks active login sessions. Defined in `app/model/account_session.rb`.

| Field | Type | Visibility | Notes |
|-------|------|-----------|-------|
| `id` | Integer | public | Primary key |
| `account_id` | Integer | public (readonly) | FK to accounts, cascade delete |
| `refresh_seq` | Integer | **hidden** | Monotonic sequence for token rotation |
| `nonce` | Integer | **hidden** | Anti-replay counter |
| `ip` | String | public | Client IP at login |
| `user_agent` | String | public | Browser user-agent string |
| `created_at` | Time | public (readonly) | |

**Repository:** `AccountSession::Repository` provides:

- `logout(session_id)` — deletes session and publishes `logged_out` event
- `check_seq(account_id, session_id, nonce, sequence)` — atomic `UPDATE ... RETURNING` that increments `refresh_seq` by 30 and checks the sequence hasn't been reused (detects token theft)
- `bump_refresh_seq(account, nonce:, session_id:, ip:, user_agent:, at:)` — upserts session on login/refresh, publishes `iam:account:login` custom event on initial login

---

### AccountAuth::Record

A pseudo-record (no DB table). Defined in `app/model/account_auth.rb`. Used exclusively as the output model for `Auth::Service.login` and `Auth::Service.refresh_token`.

| Field | Type | Visibility | Notes |
|-------|------|-----------|-------|
| `id` | Integer | public | Account ID |
| `email` | String | public | |
| `name` | String | public | |
| `picture_url` | String | public | |
| `role_name` | String | public | |
| `role_scope` | Hash | public | |
| `role_rights` | Array | public | Computed from role definition |
| `auth_token` | String | **hidden** | JWT bearer token |
| `refresh_token` | String | **hidden** | Opaque refresh JWT |
| `exp` | Integer | public | Auth token expiry timestamp |

---

### Organization::Record

Represents a tenant organization. Defined in `app/model/organization.rb`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | Integer | Primary key, `bigserial` |
| `name` | String | Organization display name |
| `created_at` | Time | Readonly |
| `updated_at` | Time | Readonly |

**Repository:** `Organization::Repository` scopes via `auth_context.can!` with `as_org_owner?` filtering to organizations in the user's `role_scope["org"]`, and `as_user?` filtering via project membership (cross-service API call to Dataset).

---

### ApiKey::Record

Machine-to-machine credentials. Defined in `app/model/api_key.rb`.

| Field | Type | Visibility | Notes |
|-------|------|-----------|-------|
| `id` | String | public | Primary key |
| `account_id` | Integer | public (readonly) | FK to the service account |
| `name` | String | public | Human-readable label |
| `key_label` | String | public (readonly) | Truncated display: first 10 chars `...` last 4 |
| `key_sha` | String | **hidden** | SHA-256 hash of the raw key |
| `permissions` | Array | public | List of permission strings (PostgreSQL text[]) |
| `scope_type` | String | public | `"all"`, `"org"`, or `"project"` |
| `scope_value` | Array | public | Array of org/project IDs scoped to |
| `expires_at` | Time or Nil | public | Optional key expiry |
| `revoked_at` | Time or Nil | public | Set on revocation |
| `status` | String | public | `"active"`, `"revoked"`, or `"expired"` |
| `last_used_at` | Time or Nil | public (readonly) | Updated on each API key login |
| `created_at` | Time | public (readonly) | |
| `updated_at` | Time | public (readonly) | |
| `key` | String | public | **Only populated at creation time** — ephemeral |

**Key methods:**
- `expired?` — checks `expires_at` against current time
- `revoked?` — checks if `revoked_at` is set
- `valid_key?` — `!expired? && !revoked?`
- `build_scope` — converts `scope_type`/`scope_value` into a scoping hash (`{}`, `{ org: [...] }`, or `{ project: [...] }`)

**Repository:** `ApiKey::Repository` uses `scope_type`/`scope_value` PostgreSQL arrays with the `<@` (contained by) operator for cross-org isolation. Encodes `permissions` and `scope_value` as `PgArray`.

---

### ApiPermission::Record

A lightweight record for listing available permissions. Defined in `app/model/api_permission.rb`. Not backed by a DB table — populated dynamically from roles matching the `^api/` prefix.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Primary key, e.g. `"project_media_read_org"` |
| `title` | String | Human-readable title from role definition |
| `description` | String | Description from role definition |

---

## Endpoints

All HTTP endpoints are served under the `/api/v1/iam` prefix (standard IDAH routing convention).

| Prefix | Endpoints | Auth | Exposition File |
|--------|-----------|------|----------------|
| `/accounts` | GET `/accounts`, GET `/accounts/:id`, POST `/accounts`, PATCH `/accounts/:id`, DELETE `/accounts/:id` | admin / org_owner | `app/expo/accounts_expo.rb` |
| `/accounts` | PATCH `/:token/join` | none (public) | `app/expo/accounts_expo.rb` |
| `/accounts` | POST `/:id/resend_invitation` | admin / org_owner | `app/expo/accounts_expo.rb` |
| `/account_sessions` | GET `/account_sessions`, DELETE `/account_sessions/:id` | own sessions only | `app/expo/account_sessions_expo.rb` |
| `/organizations` | GET `/organizations`, GET `/organizations/:id`, POST `/organizations`, PATCH `/organizations/:id`, DELETE `/organizations/:id` | admin | `app/expo/organizations_expo.rb` |
| `/api_keys` | GET `/api_keys`, GET `/api_keys/:id`, POST `/api_keys`, PATCH `/api_keys/:id`, DELETE `/api_keys/:id` | admin / org_owner | `app/expo/api_keys_expo.rb` |
| `/api_keys` | GET `/api_keys/permissions(/:scope_type)?` | admin / org_owner | `app/expo/api_keys_expo.rb` |
| `/api_keys` | POST `/api_keys/:id/revoke` | admin / org_owner | `app/expo/api_keys_expo.rb` |
| `/api_keys` | *scheduled* `expire_api_keys` (cron `15 0 * * *`) | system | `app/expo/api_keys_expo.rb` |
| `/auth` | POST `/auth/login` | public | `app/expo/auth/simple_expo.rb` |
| `/auth` | GET `/auth/refresh` | public (cookie) | `app/expo/auth/simple_expo.rb` |
| `/auth` | GET `/auth/logout` | auth | `app/expo/auth/simple_expo.rb` |
| `/auth/api` | POST `/auth/api/login` | API key | `app/expo/auth/api_expo.rb` |
| `/account/passwords` | POST `/account/passwords/request_reset` | public | `app/expo/account/passwords_expo.rb` |
| `/account/passwords` | POST `/account/passwords/reset` | public | `app/expo/account/passwords_expo.rb` |
| `/account/passwords` | GET `/account/passwords/token_valid` | public | `app/expo/account/passwords_expo.rb` |
| `/account/passwords` | POST `/account/passwords/change` | auth | `app/expo/account/passwords_expo.rb` |
| `/healthcheck` | GET | none | internal |

---

## Key Services

### Auth::Service

**File:** `app/service/auth/service.rb`

The core authentication orchestrator. Manages login, logout, token refresh, and API key authentication.

**Constants:**
- `AUTH_TOKEN_LIFETIME` = 86,400 seconds (24 hours)
- `REFRESH_TOKEN_LIFETIME` = 1,209,600 seconds (14 days)

**Methods:**

- `login(email, password, ip:, user_agent:)` — Locates the account via `Account::Repository.login` (BCrypt verify), raises `Verse::Error::Authorization` on invalid credentials or disabled account. Calls `build_tokens` to generate the JWT pair. Publishes `logged_in` resource event.

- `refresh_token(auth_token, refresh_token, ip:, user_agent:)` — Validates the refresh JWT via `RefreshToken.validate`, which checks the session's `refresh_seq` using an atomic `UPDATE ... RETURNING` to detect token replay. On success, bumps the nonce and generates a new token pair via `build_tokens`. Raises `BadRefreshTokenError` on failure.

- `logout(refresh_token)` — Extracts `session_id` from the refresh token and calls `AccountSession::Repository.logout` to delete the session (suppresses the delete event in favor of the explicit `logged_out` event).

- `login_api(key, token_expiration:)` — API key login. Validates key format (must start with `IDAH_`, 69 chars), SHA-256 hashes for lookup, checks `valid_key?` and status. Builds a JWT with `api:`-prefixed role name and the key's permission-based compound role. Updates `last_used_at`. Returns an `AccountAuth::Record` without a refresh token (API keys don't get sessions).

**Private method `build_tokens`:** Shared by `login` and `refresh_token`. Looks up the role definition from `RoleRepository`, encodes the auth JWT with `Verse::Http::Auth::Token.encode`, creates a refresh token (skipped for system accounts), and returns an `AccountAuth::Record`.

---

### Account::Service

**File:** `app/service/account/service.rb`

CRUD for accounts with invitation flow and cross-organization scope cleanup.

**Methods:**

- `index(filter, included:, page:, items_per_page:, sort:, query_count:)` — Delegates to `Account::Repository.index` with auth scoping.

- `show(id, included:)` — Finds account by ID.

- `create(record)` — Prevents creation of system/admin accounts by non-admin users. Checks for existing accounts by email (returns existing if found). Generates a random default password (`SecureRandom.hex(16)`) if none provided. Creates an invitation token valid for 3 days. Hashes the password with BCrypt. Sends `account_created` notification email.

- `update(record)` — Rejects unauthorized updates. Stores `role_scope` as JSON. After commit, triggers `RoleChangeNotification` if the role name or scope changed.

- `delete(id)` — Only allowed for accounts that haven't joined (`joined_at` is nil). Prevents deletion of active users (soft-disable via `enabled` instead).

- `mark_as_joined(token)` — Finds account by invitation token, validates expiry (3-day window), sets `joined_at` and clears `invitation_token`. Also generates a password reset token (valid 1 hour) required for the user to set their initial password.

- `resend_pending_invitations(id)` — Regenerates invitation token (invalidates previous), extends expiry by 3 more days, re-sends the notification.

- `remove_org_from_account_role_scope(organization_id)` — Cleans up all accounts' `role_scope` when an organization is deleted. Called by the `on_organization_deleted` event listener.

---

### AccountPassword::Service

**File:** `app/service/account_password/service.rb`

Handles all password lifecycle operations.

**Methods:**

- `request_password_reset(email)` — Finds account by email (returns silently if not found, avoiding user enumeration). Generates a `password_reset_token` (SecureRandom hex, valid 1 hour). Stores it in the account record (suppressing events). Sends a `password_reset` notification email.

- `reset_password(token, new_password)` — Finds account by reset token. Validates expiry. Hashes the new password with BCrypt, clears the reset token.

- `token_valid?(token)` — Returns boolean indicating whether the token exists and hasn't expired.

- `change_password(id, old_password, new_password)` — Authenticated password change. Verifies the old password via `password_match?`, then updates with the new BCrypt hash.

**Password requirements** (enforced in the exposition layer input DSL):
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

---

### ApiKey::Service

**File:** `app/service/api_key/service.rb`

Manages API key lifecycle, permission enumeration, and scheduled expiration.

**Methods:**

- `index(filter, included:, page:, items_per_page:, sort:, query_count:)` — Delegates to repository with scoping.

- `show(id, included:)` — Finds key by ID.

- `create(record)` — Intersects requested permissions with what the user is allowed to grant. Generates a raw key (`IDAH_` + 64 hex chars). SHA-256 hashes it for storage. Creates a `key_label` (first 10 chars + `...` + last 4 chars). Validates `scope_type` is `all`, `org`, or `project`. Links to the `api_service` service account. Returns the API key record **with the raw key populated** (the only time the raw key is visible).

- `update(record)` — Only `expires_at` and `name` are updatable. Rejects updates for revoked or expired keys.

- `delete(id)` — Hard deletes from the database.

- `revoke(id)` — Sets `revoked_at` and status to `"revoked"`.

- `show_permissions(scope_type)` — Returns available permissions filtered by scope type. Scoped against what the current user is allowed to create. Uses `all?` / `array?` scope callbacks to determine visibility. Filters permission suffixes based on `scope_type`:
  - `"all"` → permissions ending with `_all`
  - `"org"` → permissions ending with `_org`
  - `"project"` → permissions ending with `_org` AND starting with `project_`

- `expire_api_keys` — Scheduled task (cron: `15 0 * * *` — daily at 00:15). Finds all active keys with `expires_at <= now` and sets status to `"expired"`.

---

### Organization::Service

**File:** `app/service/organization/service.rb`

Basic CRUD for organizations.

**Methods:**

- `index`, `show`, `create`, `update` — Standard CRUD delegated to the repository.

- `delete(id)` — Guards against deletion when the organization still has projects (cross-service call to `Api[:idah].dataset.projects.index`). Raises `Unauthorized` if projects exist.

---

### AccountSession::Service

**File:** `app/service/account_session/service.rb`

Simple service for session listing and deletion.

**Methods:**

- `index(filter, included:, page:, items_per_page:, sort:, query_count:)` — Lists sessions (scoped to own sessions by default).

- `delete(id)` — Deletes a session.

---

## Auth Flow Details

### JWT Token

- **Algorithm:** ES256 (ECDSA using P-256 and SHA-256)
- **Signing key:** Loaded from `SERVICE_JWT_KEY` environment variable. Accepts raw PEM content or `file:/path/to/key.pem` reference. Configured in `config/initializers/set_keys.rb`.
- **Payload fields:** `id`, `email`, `name`, `role_name`, `role_scope` (nested JSON), `role_rights` (array of permission strings), `exp` (UNIX timestamp)
- **Auth token lifetime:** 86,400 seconds (24 hours), configurable via `IDAH_AUTH_TOKEN_EXP`
- **Refresh token:** An opaque JWT with payload `{ uid, sid, nc, refid, sub: "ort", exp }`. The `sub: "ort"` (offline refresh token) claim is verified on decode to prevent auth tokens from being used as refresh tokens.

**Session rotation:** Each refresh increments the `refresh_seq` by 30. If a client presents a `refresh_seq` that is not less than the stored value, the session is considered compromised, the session is deleted, and `BadRefreshTokenError` is raised.

### Cookie-Based Auth

Defined in `app/expo/auth/helper_methods.rb`:

| Cookie | Name | Path | Lifetime | Properties |
|--------|------|------|----------|------------|
| Auth token | `auth-token` | `/` | 24 hours | `http_only`, `secure` |
| Refresh token | `refresh-token` | `/api/v1/iam` | 14 days | `http_only`, `secure` |

- The auth cookie is set on login (if `cookie: true` parameter is passed) and refreshed on every `/auth/refresh` call.
- The refresh cookie is scoped to `/api/v1/iam` to limit exposure — only IAM service requests carry it.
- On logout, both cookies are expired by setting `expires: Time.now - 600`.
- The frontend calls `GET /auth/refresh` when the JWT expires; the auth cookie sent with the request is used to identify the user (for logging), while the refresh cookie is used for the actual token rotation.

### API Key Authentication

- API keys are generated as `IDAH_` + 64 hex characters (68 chars total + prefix = 69 chars).
- Only the SHA-256 hash is stored in the database. The raw key is returned exactly once — at creation time.
- API key login produces a JWT with a compound role name (`api:permission1,permission2`) and no refresh token (API calls are stateless).
- The JWT carries the `labels: ["api"]` field to distinguish API key requests from password login requests.
- API key tokens have a configurable expiry (default: 3600 seconds / 1 hour).

---

## Resource Constants

Defined in `common/lib/resource/iam.rb`:

```ruby
module Resource
  module Iam
    Accounts       = "iam:accounts"
    AccountSessions = "iam:account_sessions"
    AccountAuths   = "iam:account_auths"
    Organizations  = "iam:organizations"
    ApiKeys        = "iam:api_keys"
  end
end
```

These serve dual duty as JSON:API type identifiers and event channel names.

---

## DB Migrations

| Migration | File | Changes |
|-----------|------|---------|
| Initial schema | `20250714000000_create_initial_schema.rb` | Creates `accounts`, `organizations`, `account_sessions` tables. Enables `pg_trgm` extension. Installs timestamp update trigger function. |
| Invitation token | `20260114000000_add_invitation_token_to_accounts.rb` | Adds `invitation_token` column (nullable, indexed) to the `accounts` table. |
| API keys table | `20260313000000_create_api_keys_table.rb` | Creates `api_keys` table with foreign key to accounts, `key_sha` (unique, indexed), PostgreSQL `text[]` array columns for `permissions` and `scope_value`, status, expiry timestamps. |

### Table: `accounts`

```sql
CREATE TABLE accounts (
  id                          BIGSERIAL PRIMARY KEY,
  name                        TEXT,
  email                       TEXT NOT NULL UNIQUE,
  role_name                   TEXT NOT NULL DEFAULT 'user',
  role_scope                  JSONB NOT NULL DEFAULT '{}',
  picture_url                 TEXT,
  hashed_password             TEXT,
  password_reset_token        TEXT,
  password_reset_token_expires_at TIMESTAMPTZ,
  sso_channel                 TEXT,
  enabled                     BOOLEAN,
  joined_at                   TIMESTAMPTZ,
  invitation_token            TEXT,
  invitation_expired_at       TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_accounts_email ON accounts (email);
CREATE INDEX idx_accounts_enabled ON accounts (enabled);
CREATE INDEX idx_accounts_invitation_token ON accounts (invitation_token);
```

### Table: `organizations`

```sql
CREATE TABLE organizations (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table: `account_sessions`

```sql
CREATE TABLE account_sessions (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ip            TEXT,
  user_agent    TEXT,
  refresh_seq   BIGINT NOT NULL DEFAULT 0,
  nonce         BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_account_sessions_account_id ON account_sessions (account_id);
```

### Table: `api_keys`

```sql
CREATE TABLE api_keys (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          TEXT,
  key_label     TEXT NOT NULL,
  key_sha       TEXT NOT NULL UNIQUE,
  permissions   TEXT[] NOT NULL,
  scope_type    TEXT NOT NULL,   -- 'all' | 'org' | 'project'
  scope_value   TEXT[] NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'revoked' | 'expired'
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_account_id ON api_keys (account_id);
CREATE UNIQUE INDEX idx_api_keys_key_sha ON api_keys (key_sha);
CREATE INDEX idx_api_keys_status ON api_keys (status);
```

---

## Events

### Published Resource Events

| Channel | Trigger | Payload Metadata |
|---------|---------|------------------|
| `iam:accounts:logged_in` | Successful login | `actor_account_id`, `actor_account_email`, `actor_account_role_name`, `validation: true/false` |
| `iam:accounts:created` | Account creation | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:accounts:updated` | Account update | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:accounts:deleted` | Account deletion | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:account_sessions:logged_out` | Session deletion | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:organizations:created` | Organization creation | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:organizations:updated` | Organization update | `actor_account_id`, `actor_account_email`, `actor_account_role_name`, `organization_id` |
| `iam:organizations:deleted` | Organization deletion | `actor_account_id`, `actor_account_email`, `actor_account_role_name`, `organization_id` |
| `iam:api_keys:created` | API key creation | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:api_keys:updated` | API key update | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |
| `iam:api_keys:deleted` | API key deletion | `actor_account_id`, `actor_account_email`, `actor_account_role_name` |

### Published Custom Events

| Channel | Trigger | Payload |
|---------|---------|---------|
| `iam:account:login` | New session creation (distinct from refresh) | `account_id`, `account_email`, `account_role`, `ip`, `user_agent`, `at` |

### Subscribed Events

| Channel | Handler | Action |
|---------|---------|--------|
| `iam:organizations:deleted` | `AccountsExpo#on_organization_deleted` | Calls `Account::Service.remove_org_from_account_role_scope` to clean up org references in account role scopes |

---

## Key Patterns

### Session Rotation for Security

Every refresh token operation:
1. Extracts `uid` (account ID), `sid` (session ID), `nc` (nonce), and `refid` (refresh sequence) from the refresh JWT.
2. Checks session validity via `AccountSession::Repository.check_seq`, which runs:
   ```sql
   UPDATE account_sessions
   SET refresh_seq = :new_sequence
   WHERE account_id = :account_id
     AND id = :session_id
     AND nonce = :nonce
     AND refresh_seq < :new_sequence
   RETURNING id
   ```
3. If the UPDATE returns no rows, the session has been compromised (sequence reused). The session is deleted, and all sessions for the account are effectively invalidated.

This provides **theft detection**: if an attacker steals a refresh token and the legitimate user refreshes, or vice versa, the `refresh_seq` check fails for the second attempt.

### Password Storage

- Passwords are hashed with **BCrypt** (`BCrypt::Password.create`) before storage. The hash includes a built-in salt.
- The `hashed_password` field is marked `visible: false` in the record definition, ensuring it is never included in JSON:API responses.
- Password verification uses `BCrypt::Password.new(hashed_password) == password`.
- API keys use **SHA-256** (not BCrypt) because they are long, high-entropy random strings where slow hashing is unnecessary.

### Soft-Delete via `enabled` Flag

Accounts are **not physically deleted** after joining. Instead:
- The `enabled` boolean is set to `false` to disable access.
- Pre-join accounts (no `joined_at`) can be hard-deleted since they have no data.
- This preserves referential integrity with entries, annotations, and other data owned by the account.

### Service Account for Inter-Service Auth

The IAM service configures a service account credential in `config.yml`:

```yaml
credentials:
  account: <%= ENV.fetch("IDAH_SERVICE_ACCOUNT") %>
  password: <%= ENV.fetch("IDAH_SERVICE_PASSWORD") %>
```

Downstream services use this credential to authenticate API calls to IAM (and to other services via the shared API client in `common/lib/api.rb`).

### Timing Attack Mitigation

The `Account::Repository.login` method delays response by a random 300–500ms when the email is not found, preventing attackers from inferring valid email addresses through response time differences.

### Cross-Service API Calls

The IAM service calls the Dataset service for:
- `Account::Repository#accounts_from_project_member_scoped` — fetching project members to determine org-owner scoped account visibility
- `Organization::Repository#organizations_from_project_member_scoped` — fetching projects the user belongs to for org visibility
- `Organization::Service#delete` — checking for remaining projects before deletion
- `ApiKey::Repository#projects_from_organization_scoped` — filtering API keys to those scoped within the org owner's organization

These calls use the `Api[:idah].dataset.*` client interface defined in `common/lib/api.rb`.

---

## Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `SERVICE_JWT_KEY` | PEM-encoded EC P-256 key (raw or `file:` prefix) | — |
| `DATABASE_URI` | PostgreSQL connection string | — |
| `REDIS_STREAM_URL` | Redis connection URL for event bus | — |
| `IDAH_SERVICE_ACCOUNT` | Service account email for inter-service auth | — |
| `IDAH_SERVICE_PASSWORD` | Service account password | — |
| `IDAH_AUTH_TOKEN_EXP` | Auth token lifetime in seconds | 86400 |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `LOG_SHOW_ERROR_DETAILS` | Include error details in HTTP responses | `true` |

---

## Boot Sequence

1. `config/boot.rb` — Sets up Zeitwerk autoloading (includes `app/`, `expo/`, `model/`, `service/`, `util/`, and `common/lib/`), loads routes, runs initializers.
2. `config/initializers/set_keys.rb` — Loads the JWT signing key from `SERVICE_JWT_KEY` env.
3. `config/initializers/load_roles.rb` — Loads role definitions from YAML files into `RoleRepository`, sets `Verse::Auth::Context.backend = RoleBackend`.
4. `config/initializers/cookies.rb` — Includes `Sinatra::Cookies` helper for cookie management.
5. `config/routes.rb` — Registers all exposition classes (`HealthcheckExpo`, `OrganizationsExpo`, `AccountsExpo`, `AccountSessionsExpo`, `Auth::SimpleExpo`, `Account::PasswordsExpo`, `ApiKeysExpo`, `Auth::ApiExpo`).

---

## Related Guides

| Guide | Link |
|-------|------|
| Auth & Authorization (cross-service) | [`guide/auth-authorization.md`](auth-authorization.md) |
| Verse Layered Architecture | [`guide/verse-architecture.md`](verse-architecture.md) |
| Exposition Layer | [`guide/exposition-layer.md`](exposition-layer.md) |
| Service Layer | [`guide/service-layer.md`](service-layer.md) |
| Model & Repository | [`guide/model-repository.md`](model-repository.md) |
| Event System | [`guide/event-system.md`](event-system.md) |
| Inter-Service API Client | [`guide/inter-service-api.md`](inter-service-api.md) |
| Frontend | [`guide/frontend.md`](frontend.md) |
