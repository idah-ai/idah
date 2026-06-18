# IAM Service Security & Code Audit

**Scope:** `idah/app/iam/` — expositions, models, services, utilities, config, migrations, rake tasks.
**Method:** Static review of every `.rb` file in scope plus supporting config (`config.ru`, `dev-entrypoint.sh`, `Gemfile`, migrations).
**Date:** 2026-06-18

---

## Executive Summary

The IAM service implements a sensible Verse-style layered architecture (Exposition → Service → Repository → DB) and uses bcrypt for password hashing, SHA-256 hashing for API keys, JWT-based refresh tokens guarded by a server-side `refresh_seq`/`nonce` replay-defense, and auth-scoped repositories. However, the audit uncovered **several high- and critical-severity issues** that undermine the security posture of an authentication-critical service:

- **Critical:** The `Auth::Service#login` flow uses the *auth-scoped* `Account::Repository` to look up the account during login, but `Account::Repository#scoped(:login)` falls back to `scope.own { table.where(id: auth_context.metadata[:id]) }` for ordinary users — meaning an unauthenticated context can never find any account, and the timing-attack mitigation only fires for the "all" / "org_owner" branches. Combined with the `auth_context.can!(:login, ...)` call, login can be silently broken for non-admin roles or, worse, allow scope leakage depending on how the `:login` action is granted to roles.
- **Critical:** The `join` invitation endpoint (`PATCH /accounts/:token/join`) is unauthenticated (`auth: nil`) and trusts the URL parameter `:token` rather than the request body, but the route is registered as `/:token/join` while the exposition declares `input { field :token }` — there is no path binding, so `params[:token]` is `nil` unless the framework auto-populates it. If a user can guess or enumerate `SecureRandom.hex(32)` tokens this is low risk, but the bigger issue is that **invitation tokens are never rotated after a successful join** (the column is set to `nil` only via the `joined_at` update path, but `mark_as_joined` first looks up by token then nulls it — fine), **however the password-reset token generated at join time is returned in the HTTP response `meta`**, allowing anyone who intercepts the response (e.g. shared device, logging proxy) to take over the account.
- **High:** `RefreshToken` module memoizes a single `AccountSession::Repository` instance in a class-level `@account_sessions` ivar. Under Puma multi-threading (default 16 threads) this is **shared mutable state without synchronization** and bypasses the per-request `auth_context`, which can leak session data across requests and break the Verse auth-context propagation contract.
- **High:** `Account::Service#create` returns the *existing* account (without re-sending the invitation) when an account with the same email already exists. This is an **account-enumeration vector** and also silently swallows the caller's intent.
- **High:** `Account::Repository#login` uses `Sequel.lit`-free `where(email:)` but the timing-attack mitigation `sleep(rand(0.3..0.5))` is **non-constant** and only triggered when the account is not found — when the account exists but the password is wrong, no equivalent delay is added, so login timing still leaks whether an email exists.
- **Medium:** API key validation in `Auth::Service#login_api` uses `Digest::SHA256.hexdigest` (unsalted, fast hash) — acceptable for high-entropy 256-bit keys but the lookup is **not constant-time** and the error messages distinguish "Invalid credentials" from "revoked or expired" from "not active", enabling key-status enumeration.
- **Medium:** Cookies set by `Auth::HelperMethods` are missing the `same_site` attribute, leaving the auth/refresh tokens weakly protected against CSRF.
- **Medium:** `Account::Service#update` allows changing `role_name` and `role_scope` without re-checking that the actor is allowed to grant the target role — a privilege-escalation vector if a non-admin can reach the update path with `role_name: "admin"` or `"system"`.
- Numerous **code smells** (dead code, duplicated password-policy blocks, magic strings like `"system"`, `"api_service"`, `"active"`, hardcoded `Resource::Iam::*` strings in services, `SecureRandom.uuid`-style usage where `UUIDv7.generate` is mandated by project rules — though here `SecureRandom.hex` is used for tokens, which is acceptable).

Detailed findings below.

---

## Findings Index

| ID  | Severity | Category     | File:Line                                                              | Title |
|-----|----------|--------------|------------------------------------------------------------------------|-------|
| F01 | Critical | Security     | `app/service/account/service.rb:43-44, 109-128`                        | Password-reset token returned in HTTP response after invitation join |
| F02 | Critical | Security     | `app/service/auth/service.rb:36-48` + `app/model/account.rb:52-84`    | Login flow depends on auth-scoped repository, breaking unauthenticated lookup & leaking scope semantics |
| F03 | Critical | Security     | `app/service/account/service.rb:36-43`                                | Account enumeration via create-or-return-existing behavior |
| F04 | High     | Security     | `app/service/refresh_token.rb:43-47`                                   | Shared memoized repository across requests — thread-safety & auth-context leak |
| F05 | High     | Security     | `app/model/account.rb:62-84`                                           | Asymmetric timing-attack mitigation in `login` |
| F06 | High     | Security     | `app/service/account/service.rb:77-96`                                | Role/role_scope update lacks target-role authorization (privilege escalation) |
| F07 | High     | Security     | `app/expo/auth/helper_methods.rb:22-71`                                | Cookies missing `same_site` attribute (CSRF risk) |
| F08 | High     | Security     | `app/service/auth/service.rb:68-92`                                    | API-key login returns distinguishable error messages (status enumeration) |
| F09 | High     | Security     | `app/service/account_password/service.rb:26-45`                       | Password-reset token not single-use — concurrent reset race & no rotation on read |
| F10 | Medium   | Security     | `app/service/api_key/service.rb:44-49`                                 | API key label leaks first 10 chars of raw key |
| F11 | Medium   | Security     | `app/model/account_session.rb:40-57`                                   | `check_seq` UPDATE lacks `account_id` index-friendly shape & no row lock |
| F12 | Medium   | Security     | `app/expo/accounts_expo.rb:36-49`                                       | `join` endpoint is unauthenticated and trusts URL `:token` |
| F13 | Medium   | Performance  | `app/model/account.rb:123-139`                                         | N+1 cross-service call (`Api[:idah]`) inside repository scope builder |
| F14 | Medium   | Performance  | `app/model/api_key.rb:120-136`                                         | Cross-service `Api[:idah]` call on every API-key list/show |
| F15 | Medium   | Performance  | `app/service/account/service.rb:156-163`                              | `chunked_index` + per-row `update!` is N+1 |
| F16 | Medium   | CodeSmell    | `app/expo/account/passwords_expo.rb:46-63, 104-121`                    | Duplicated password-policy rule block |
| F17 | Medium   | Architecture | `app/service/account/service.rb:9` + `:62, :158`                      | `use_system_repo` for accounts — justification unclear for `find_by` in create |
| F18 | Medium   | Architecture | `app/service/auth/service.rb:12-16`                                    | Heavy `use_system_repo` usage — bypasses auth scope for sessions/roles/api_keys |
| F19 | Medium   | CodeSmell    | `app/service/account/service.rb:27`                                    | Broken boolean expression `("system" || "admin")` always yields `"system"` |
| F20 | Medium   | CodeSmell    | `app/service/account/service.rb:46, 49, 139, 168` + `account_password/service.rb:75` | `SecureRandom.hex` used for tokens instead of `UUIDv7.generate` (project rule) |
| F21 | Medium   | CodeSmell    | multiple                                                                | Hardcoded role/status strings (`"system"`, `"api_service"`, `"active"`, `"revoked"`, `"expired"`) |
| F22 | Medium   | CodeSmell    | `app/service/api_key/service.rb:117, 152`                              | Hardcoded `"iam:api_keys"` instead of `Resource::Iam::ApiKeys` constant |
| F23 | Low      | Security     | `config/initializers/set_keys.rb:22-25`                                | Public-key detection logs at debug but service still starts unable to sign tokens |
| F24 | Low      | Security     | `config/config.yml:9` + `config.development.yml:9`                     | `show_error_details` defaults to `"true"` — leaks stack traces |
| F25 | Low      | Security     | `config/tasks/dev.rake:21, 44`                                          | Hardcoded dev admin password `"P@ssword01"` |
| F26 | Low      | Security     | `db/migrations/20250714000000_create_initial_schema.rb:21`             | `password_reset_token` column is not `unique` / not indexed |
| F27 | Low      | Security     | `app/expo/auth/simple_expo.rb:79-82`                                   | Swallowed exception: `rescue ... => e; e` returns the error object as response body |
| F28 | Low      | CodeSmell    | `app/expo/accounts_expo.rb:36-41`                                      | `join` route declares `input { field :token }` but route is `/:token/join` (param mismatch) |
| F29 | Low      | CodeSmell    | `app/service/account/service.rb:11-20`                                | Default `items_per_page: 1000` for account index — unbounded list risk |
| F30 | Low      | CodeSmell    | `app/model/account.rb:42-50`                                           | Raw `Sequel.lit` with interpolated JSON — verify parameterization |
| F31 | Info     | Architecture | `app/expo/account_sessions_expo.rb`                                     | `AccountSessionsExpo` has no `scoped(action)` override at expo level (relies on repo) |
| F32 | Info     | CodeSmell    | `config/routes.rb:6, 11`                                               | `OrganizationsExpo` registered twice |
| F33 | Info     | CodeSmell    | `app/model/account.rb:37`                                              | Stale TODO comment about account-creation scope |
| F34 | Info     | CodeSmell    | `app/service/auth/service.rb:8-10`                                    | `use_repo` vs `use_system_repo` mixed naming (likely API drift) |

---

## F01 — Password-reset token returned in HTTP response after invitation join

**Severity:** Critical · **Category:** Security · **Effort:** S

**Description**
`Account::Service#mark_as_joined` generates a fresh `password_reset_token` for the just-joined account and returns it to the exposition, which places it in the response `meta`:

```ruby
# app/expo/accounts_expo.rb:42-49
def join
  account, password_reset_token = service.mark_as_joined(params[:token])
  renderer.meta = {
    password_reset_token: password_reset_token
  }
  account
end
```

```ruby
# app/service/account/service.rb:124-128
[
  accounts.find!(account.id, scope: accounts.scoped(:join)),
  update_password_reset_token(account)
]
```

**Impact**
Anyone able to observe the HTTP response body (shared device, browser extension, HTTP intermediary logging, error monitoring tool that captures response bodies, screen recording, etc.) obtains a valid 1-hour password-reset token for the just-joined account and can immediately take it over. The token is also unnecessary in the response — the user just set up their account, the front-end can prompt them to set a password through the normal authenticated `change_password` flow.

**Evidence**
- `app/expo/accounts_expo.rb:42-49`
- `app/service/account/service.rb:109-128` and `:167-182`

**Recommendation**
Drop the password-reset token from the response entirely. If a password must be set post-join, require the user to authenticate first and use `POST /account/passwords/change`, or send the reset token only via the existing email-based `request_password_reset` flow.

---

## F02 — Login flow depends on auth-scoped repository

**Severity:** Critical · **Category:** Security · **Effort:** M

**Description**
`Auth::Service#login` calls `accounts.login(email, password)` where `accounts` is the *auth-scoped* `Account::Repository`. The repository's `scoped(:login)` is:

```ruby
# app/model/account.rb:52-60
def scoped(action)
  auth_context.can!(action, self.class.resource) do |scope|
    scope.all? { table }
    scope.as_org_owner? { accounts_from_project_member_scoped }
    scope.own { table.where(id: auth_context.metadata[:id]) }
  end
end
```

For an unauthenticated caller the auth context is `anonymous`. Whether `:login` resolves to `all?`, `as_org_owner?`, or `own` depends entirely on the role configuration in `common/data/roles/`. If `anonymous` does not have `:login` with `:all` scope, the lookup `scoped(:login).where(email:).first` will either raise `Verse::Error::Authorization` (caught nowhere in `Auth::Service#login` — only `RecordNotFound` is rescued) or silently return `nil` for every email, making login impossible. Conversely, if `anonymous` is granted `:own`, the lookup is constrained to `id = auth_context.metadata[:id]` which is `nil` for anonymous — also broken.

**Impact**
- Functional: login may be broken for non-admin roles depending on role YAML.
- Security: the login path is coupled to authorization policy in a non-obvious way; a future role edit can break or weaken login.
- The timing-attack mitigation (`sleep(rand(0.3..0.5))`) only fires when the *scoped* lookup returns nil — for `own` scope it always returns nil for unknown IDs, so the sleep always fires, but for `all?` scope it fires only when the email is unknown, leaking existence.

**Evidence**
- `app/service/auth/service.rb:36-48`
- `app/model/account.rb:52-84`

**Recommendation**
Use `system_accounts` (already declared via `use_system_repo`) for the login lookup. The login flow is by definition pre-authentication and must not depend on the caller's auth scope. Apply the timing-attack mitigation symmetrically (see F05).

---

## F03 — Account enumeration via create-or-return-existing

**Severity:** Critical · **Category:** Security · **Effort:** S

**Description**
`Account::Service#create` short-circuits when an account with the same email already exists:

```ruby
# app/service/account/service.rb:36-43
account = accounts_system.find_by({ email: attr[:email] })

# If account with the email already exists, return it
if account
  auth_context.mark_as_checked!
  return account
end
```

**Impact**
- An authenticated user with `:create` permission on accounts can probe whether any email is already registered by attempting to create it and observing whether the response is a fresh account (with invitation email sent) or an existing record.
- The returned existing account may include fields the caller should not see (depending on record visibility).
- The caller's intent (send invitation) is silently swallowed.

**Evidence**
- `app/service/account/service.rb:36-43`

**Recommendation**
Return a generic "account already exists" error (`Verse::Error::ValidationFailed`) without distinguishing it from other validation failures, or send the invitation email again idempotently. Do not return the existing record's fields.

---

## F04 — Shared memoized repository in `RefreshToken` module

**Severity:** High · **Category:** Security / Thread-safety · **Effort:** S

**Description**
```ruby
# app/service/refresh_token.rb:43-47
protected

def account_sessions
  @account_sessions ||= AccountSession::Repository.new(Verse::Auth::Context[:system])
end
```

`RefreshToken` is `extend self` (a module singleton), so `@account_sessions` is a single instance variable on the module object, shared across all threads and all requests. Under Puma's default 16-thread configuration this is shared mutable state with no `MonitorMixin`.

**Impact**
- Thread-safety violation per project Golden Rule #10.
- The repository is constructed with `Verse::Auth::Context[:system]`, bypassing per-request auth context — every refresh-token validation runs as the system principal, which is correct for this specific check but means the auth-context contract is silently broken here.
- The memoization means tests must manually `instance_variable_set(:@account_sessions, nil)` (already seen in `refresh_token_spec.rb:20`), confirming this is a known smell.

**Evidence**
- `app/service/refresh_token.rb:43-47`
- `app/service/refresh_token_spec.rb:20` (test manually clears the ivar)

**Recommendation**
Drop the memoization and construct the repository per call, or wrap in a `MonitorMixin`-synchronized lazy initializer. Pass the auth context explicitly.

---

## F05 — Asymmetric timing-attack mitigation in `login`

**Severity:** High · **Category:** Security · **Effort:** S

**Description**
```ruby
# app/model/account.rb:62-84
def login(email, password)
  account = scoped(:login).where(email:).first

  if account
    account = decode(account)
    account = self.class.model_class.new(account)
    valid = account.password_match?(password)
    # ... metadata
  else
    sleep(rand(0.3..0.5))
    valid = false
  end

  valid ? account : nil
end
```

**Impact**
- When the email exists but the password is wrong, the function executes bcrypt (~100ms at default cost) and returns — no extra sleep.
- When the email does not exist, the function sleeps 300–500ms.
- The two paths are distinguishable by timing, defeating the purpose of the mitigation.
- Additionally, `sleep(rand(0.3..0.5))` is non-deterministic, which is fine for jitter but should be paired with an equivalent delay on the "wrong password" path.

**Evidence**
- `app/model/account.rb:62-84`

**Recommendation**
Always run a dummy bcrypt comparison (`BCrypt::Password.new(dummy_hash) == password`) when the account is not found, so both paths take roughly the same time. Then optionally add jitter.

---

## F06 — Role/role_scope update lacks target-role authorization

**Severity:** High · **Category:** Security · **Effort:** M

**Description**
`Account::Service#update` only checks that the actor can `:update` accounts in general:

```ruby
# app/service/account/service.rb:77-96
def update(record)
  auth_context.reject! unless auth_context.can?(:update, accounts.class.resource)

  accounts.transaction do
    previous_account = accounts.find!(record.id)
    role_scope = record.attributes[:role_scope]
    record.attributes[:role_scope] = role_scope.to_json if role_scope&.any?
    accounts.update!(record.id, record.attributes)
    # ...
  end
end
```

There is no check that the actor is allowed to *grant* the target `role_name` (e.g. `"admin"`, `"system"`) or to modify `role_scope` to include orgs/projects they do not own.

**Impact**
An `org_owner` (or any role with `:update` on accounts) could escalate privileges by setting `role_name: "admin"` or expanding their own `role_scope` to include arbitrary org IDs.

**Evidence**
- `app/service/account/service.rb:77-96`
- Compare with `ApiKey::Service#create:34-40` which *does* validate permissions against the caller's allowed scope — accounts do not.

**Recommendation**
Before applying `role_name` or `role_scope` changes, verify the actor can grant the target role/scope. Reuse the pattern from `ApiKey::Service#create` (`auth_context.can!(:create, ...) do |scope| ... end`).

---

## F07 — Cookies missing `same_site` attribute

**Severity:** High · **Category:** Security (CSRF) · **Effort:** S

**Description**
```ruby
# app/expo/auth/helper_methods.rb:27-48
def set_refresh_cookie(value)
  if value
    server.response.set_cookie(
      REFRESH_TOKEN_NAME,
      value:,
      path: REFRESH_TOKEN_PATH,
      expires: Time.now + REFRESH_TOKEN_LIFETIME,
      http_only: true,
      secure: true
    )
  else
    # ...
  end
end
```

Both `set_auth_cookie` and `set_refresh_cookie` set `http_only: true` and `secure: true` but omit `same_site`. The auth-token cookie has `path: "/"` so it is sent on every cross-site request.

**Impact**
Without `SameSite=Lax` (or `Strict`), the auth and refresh cookies may be sent on cross-site POSTs, enabling CSRF on state-changing endpoints that rely solely on cookie-based auth.

**Evidence**
- `app/expo/auth/helper_methods.rb:22-71`

**Recommendation**
Add `same_site: :lax` (or `:strict`) to every `set_cookie` call.

---

## F08 — API-key login returns distinguishable error messages

**Severity:** High · **Category:** Security (enumeration) · **Effort:** S

**Description**
```ruby
# app/service/auth/service.rb:82-92
unless api_key
  raise Verse::Error::Authorization, "Invalid credentials"
end

unless api_key.valid_key?
  raise Verse::Error::Authorization, "API key has been revoked or expired"
end

unless api_key.status == "active"
  raise Verse::Error::Authorization, "API key is not active (status: #{api_key.status})"
end
```

**Impact**
An attacker who obtains a leaked key hash (or guesses the 256-bit SHA — unlikely) can determine the key's status (active / revoked / expired / inactive) by reading the error message. The `status: #{api_key.status}` interpolation also leaks the internal status string.

**Evidence**
- `app/service/auth/service.rb:82-92`

**Recommendation**
Collapse all failure paths into a single generic `"Invalid credentials"` error.

---

## F09 — Password-reset token not single-use / no rotation on read

**Severity:** High · **Category:** Security · **Effort:** S

**Description**
`AccountPassword::Service#token_valid?` reads the token without consuming it:

```ruby
# app/service/account_password/service.rb:47-55
def token_valid?(token)
  account = account_repo.find_by({ password_reset_token: token })
  return false unless account
  return false if account_token_expired?(account)
  true
end
```

And `reset_password` only nulls the token *after* a successful reset. There is no lock or atomic "consume" step.

**Impact**
- A compromised reset token can be validated via `GET /account/passwords/token_valid` and then reused in a separate `POST /account/passwords/reset` request — the validation endpoint is essentially a token oracle.
- Concurrent reset requests can race: two requests both read the token, both pass the check, both update the password — the second overwrites the first, but both succeed.
- The token is stored in plaintext in the DB; a DB read leak (e.g. backup, SQL injection elsewhere) exposes all live reset tokens directly.

**Evidence**
- `app/service/account_password/service.rb:26-55`

**Recommendation**
- Hash the reset token at rest (like API keys).
- Make `token_valid?` a pure syntactic check, or rate-limit it heavily, or remove it.
- Use an atomic `UPDATE ... WHERE password_reset_token = ? RETURNING id` in `reset_password` to consume the token in a single step.

---

## F10 — API key label leaks first 10 characters of raw key

**Severity:** Medium · **Category:** Security · **Effort:** S

**Description**
```ruby
# app/service/api_key/service.rb:48-49
# Generate key label (first 10 characters + ... + last 4 characters)
attr[:key_label] = "#{raw_key[0..9]}...#{raw_key[-4..]}"
```

`raw_key` starts with `"IDAH_"` (5 chars), so the label exposes the next 5 hex characters plus the last 4. The full key is `IDAH_` + 64 hex chars (32 bytes).

**Impact**
Reduces the effective search space for an attacker who has read access to the `key_label` column (e.g. via a different IDOR). With 5+4 = 9 known hex characters, brute force drops from 2^256 to 2^220 — still infeasible, but the leak is unnecessary.

**Evidence**
- `app/service/api_key/service.rb:44-49`

**Recommendation**
Use a separate random label (e.g. `SecureRandom.hex(4)`) or store only the last 4 characters.

---

## F11 — `check_seq` UPDATE has no row lock and shape is index-unfriendly

**Severity:** Medium · **Category:** Security / Performance · **Effort:** S

**Description**
```ruby
# app/model/account_session.rb:40-57
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

**Impact**
- The UPDATE is correct as an atomic compare-and-set, but there is no `FOR UPDATE` lock in the surrounding transaction and the function is not wrapped in `transaction do ... end`. Two concurrent refresh requests with the same `sid`/`nonce` can both pass the `refresh_seq < :refresh_seq` check if the second reads before the first commits — depending on isolation level, this can allow refresh-token replay.
- The compound condition `(account_id, id, nonce)` is not covered by a single composite index; the migration only indexes `account_id`.

**Evidence**
- `app/model/account_session.rb:40-57`
- `db/migrations/20250714000000_create_initial_schema.rb:42-61` (only `account_id` is indexed)

**Recommendation**
Wrap in a transaction with `SELECT ... FOR UPDATE` on the session row, or rely on the atomic UPDATE alone but document the isolation-level assumption. Add a composite index on `(account_id, id, nonce)` or `(id, nonce)`.

---

## F12 — `join` endpoint is unauthenticated and trusts URL `:token`

**Severity:** Medium · **Category:** Security · **Effort:** S

**Description**
```ruby
# app/expo/accounts_expo.rb:36-49
expose on_http(:patch, "/:token/join", auth: nil) do
  desc "Mark account as joined when user accepts invitation"
  input do
    field :token, String
  end
end
def join
  account, password_reset_token = service.mark_as_joined(params[:token])
  # ...
end
```

**Impact**
- The endpoint is unauthenticated (correct — the user has not yet joined), but the token is taken from the URL path. URL paths are logged by proxies, may appear in `Referer` headers, and persist in browser history.
- The `input { field :token }` declaration suggests the framework expects `:token` in the body, but the route is `/:token/join` — depending on Verse's parameter binding, `params[:token]` may be `nil` and the request may always fail (see F28). The spec at `accounts_expo_spec.rb:101-109` mocks the service and never exercises the real param binding, so this is unverified.

**Evidence**
- `app/expo/accounts_expo.rb:36-49`
- `app/expo/accounts_expo_spec.rb:101-109`

**Recommendation**
Accept the token in the request body (`POST /accounts/join` with `{ token: ... }`), not in the URL. Use `POST` not `PATCH` since the operation is not idempotent (it generates a password-reset token).

---

## F13 — N+1 cross-service call inside `Account::Repository` scope builder

**Severity:** Medium · **Category:** Performance · **Effort:** M

**Description**
```ruby
# app/model/account.rb:123-139
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
  # ...
end
```

**Impact**
Every request from an `org_owner`-scoped user that touches the accounts repository triggers a synchronous HTTP call to the `idah` (dataset) service. This is on the hot path of every list/show/update.

**Evidence**
- `app/model/account.rb:123-139`

**Recommendation**
Cache the membership lookup per auth context (it does not change within a request), or push the scope evaluation down into a single SQL query via a view or materialized role-scope table.

---

## F14 — Cross-service `Api[:idah]` call on every API-key list/show

**Severity:** Medium · **Category:** Performance · **Effort:** M

**Description**
```ruby
# app/model/api_key.rb:120-136
def projects_from_organization_scoped
  organization_id = auth_context.custom_scopes[:org]&.first
  return table.where(Sequel.lit("false")) unless organization_id

  projects = Api[:idah].dataset.projects.index(filter: { organization_id: }).data
  # ...
end
```

**Impact**
Same as F13 — synchronous cross-service HTTP on every API-key repository read for org owners.

**Evidence**
- `app/model/api_key.rb:120-136`

**Recommendation**
Same as F13.

---

## F15 — `remove_org_from_account_role_scope` is N+1

**Severity:** Medium · **Category:** Performance · **Effort:** S

**Description**
```ruby
# app/service/account/service.rb:156-163
accounts_system.chunked_index({ with_role_scope: { org: [organization_id.to_s] } }).each do |account|
  account.role_scope["org"] = account.role_scope["org"] - [organization_id.to_s]
  accounts.update!(account.id, { role_scope: account.role_scope })
end
```

**Impact**
One UPDATE per matching account, inside a Ruby loop. For an org with many members this is slow and holds the transaction open.

**Evidence**
- `app/service/account/service.rb:156-163`

**Recommendation**
Issue a single `UPDATE accounts SET role_scope = jsonb_set(...)` with a `WHERE role_scope @> ...` clause.

---

## F16 — Duplicated password-policy rule block

**Severity:** Medium · **Category:** CodeSmell · **Effort:** S

**Description**
The exact same five-rule password policy block appears twice in `app/expo/account/passwords_expo.rb` (lines 46-63 for `reset` and 104-121 for `change`).

**Impact**
Maintenance burden — any policy change must be applied in two places.

**Evidence**
- `app/expo/account/passwords_expo.rb:46-63` and `:104-121`

**Recommendation**
Extract into a shared schema/contract (e.g. a `PasswordContract` module) and reuse.

---

## F17 — `use_system_repo` for accounts in `Account::Service`

**Severity:** Medium · **Category:** Architecture · **Effort:** S

**Description**
```ruby
# app/service/account/service.rb:9
use_system accounts_system: Account::Repository
```

Used at lines 37 (`find_by` email in create) and 62 (`find!` after create) and 158 (`chunked_index` in org removal).

**Impact**
- The create-path `find_by` is the root cause of F03 (enumeration).
- The post-create `find!` is justified (project membership not yet created).
- The org-removal chunked_index is justified (cross-account update).

**Evidence**
- `app/service/account/service.rb:9, 37, 62, 158`

**Recommendation**
Keep `use_system` for the post-create find and the org-removal scan, but replace the create-path email probe with a scoped existence check that does not leak the existing record.

---

## F18 — Heavy `use_system_repo` in `Auth::Service`

**Severity:** Medium · **Category:** Architecture · **Effort:** M

**Description**
```ruby
# app/service/auth/service.rb:12-16
use_system_repo \
  system_accounts: Account::Repository,
  system_account_sessions: AccountSession::Repository,
  system_roles: RoleRepository,
  system_api_keys: ApiKey::Repository
```

**Impact**
- `system_accounts` is used in `refresh_token` (line 55) — justified, the caller is anonymous.
- `system_account_sessions` is used in `logout` (line 65) — justified.
- `system_roles` is used in `build_tokens` and `api_role_rights` — justified (role lookup is global).
- `system_api_keys` is used in `login_api` (line 77, 117) — justified (API key login is pre-auth).

All four uses are individually defensible, but the pattern means the auth service operates almost entirely as the system principal. Any future addition to this service that uses these system repos inherits system-level access.

**Evidence**
- `app/service/auth/service.rb:12-16, 55, 65, 77, 117, 143, 156`

**Recommendation**
Document each `use_system_repo` with a comment justifying why the system principal is required. Consider a lint rule forbidding new `system_*` repo uses without a justification comment.

---

## F19 — Broken boolean expression `("system" || "admin")`

**Severity:** Medium · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/service/account/service.rb:27
if record.attributes[:role_name] == ("system" || "admin") && \
   auth_context.can?(:create, projects.class.resource) != :all
```

In Ruby, `"system" || "admin"` evaluates to `"system"` (the first truthy value), so this condition only ever checks `role_name == "system"`. The `"admin"` branch is dead.

**Impact**
A user creating an account with `role_name: "admin"` is not blocked by this guard.

**Evidence**
- `app/service/account/service.rb:27`

**Recommendation**
Use `%w[system admin].include?(record.attributes[:role_name])`.

---

## F20 — `SecureRandom.hex` used for tokens

**Severity:** Medium · **Category:** CodeSmell (project-rule violation) · **Effort:** S

**Description**
Project Golden Rule #10 specifies `UUIDv7.generate` for UUIDs. The following use `SecureRandom.hex`:

- `app/service/account/service.rb:46` (default password — acceptable)
- `app/service/account/service.rb:49` (invitation token)
- `app/service/account/service.rb:139` (resend invitation token)
- `app/service/account/service.rb:168` (password reset token)
- `app/service/account_password/service.rb:75` (password reset token)
- `app/service/api_key/service.rb:44` (raw API key)

**Impact**
Strictly these are random opaque tokens, not UUIDs, so `SecureRandom.hex(32)` is cryptographically appropriate and arguably better than UUIDv7 (which is time-ordered and reveals creation time). The project rule is about *identifier* generation, not token generation. This finding is informational — flagging for consistency review.

**Evidence**
- Multiple files above.

**Recommendation**
Confirm with the team whether the project rule applies to opaque auth tokens. If yes, switch to `UUIDv7.generate`; if no, add a comment justifying `SecureRandom.hex`.

---

## F21 — Hardcoded role/status strings

**Severity:** Medium · **Category:** CodeSmell · **Effort:** M

**Description**
Magic strings throughout the service:

- `"system"`, `"admin"`, `"user"`, `"org_owner"`, `"api_service"` (role names)
- `"active"`, `"revoked"`, `"expired"`, `"inactive"` (API key statuses)
- `"all"`, `"org"`, `"project"` (scope types)
- `"api_service"` lookup in `ApiKey::Service#create:62`

**Impact**
Typos are silent; refactoring role names requires grep-and-replace.

**Evidence**
- `app/service/account/service.rb:27, 158`
- `app/service/api_key/service.rb:53, 67, 90, 110, 121-137, 144-145`
- `app/model/api_key.rb:50-59`
- `app/service/auth/service.rb:99, 176`
- `app/service/account/role_change_notification.rb:11-27`

**Recommendation**
Extract role names, statuses, and scope types into constants (e.g. `Role::Name::SYSTEM`, `ApiKey::Status::ACTIVE`).

---

## F22 — Hardcoded `"iam:api_keys"` resource string

**Severity:** Medium · **Category:** CodeSmell (project-rule violation) · **Effort:** S

**Description**
```ruby
# app/service/api_key/service.rb:34, 117
auth_context.can!(:create, "iam:api_keys") do |scope|
```

Project Golden Rule #4 mandates `Resource::Service::Entity` constants. The model file uses `Resource::Iam::ApiKeys` correctly (`app/model/api_key.rb:5`), but the service bypasses it.

**Evidence**
- `app/service/api_key/service.rb:34, 117`

**Recommendation**
Replace `"iam:api_keys"` with `ApiKey::Record.resource` or `Resource::Iam::ApiKeys`.

---

## F23 — Service starts even when JWT key is public-only

**Severity:** Low · **Category:** Security · **Effort:** S

**Description**
```ruby
# config/initializers/set_keys.rb:20-25
key = OpenSSL::PKey::EC.new(key_content)

unless key.private?
  Verse.logger = Logger.new($stdout)
  Verse.logger.debug{ "Using a public key to sign tokens. ..." }
end
```

**Impact**
If the IAM service (which *must* sign tokens) is misconfigured with a public key, it starts up and only logs at debug level. Token signing will fail at runtime with a cryptic OpenSSL error instead of failing fast at boot.

**Evidence**
- `config/initializers/set_keys.rb:20-27`

**Recommendation**
For the IAM service specifically, raise at boot if the key is not private.

---

## F24 — `show_error_details` defaults to true

**Severity:** Low · **Category:** Security (info disclosure) · **Effort:** S

**Description**
```yaml
# config/config.yml:9
show_error_details: <%= ENV.fetch("LOG_SHOW_ERROR_DETAILS", "true") %>
```

Same in `config.development.yml:9`.

**Impact**
If `LOG_SHOW_ERROR_DETAILS` is not set in production, stack traces and internal error details are returned to clients.

**Evidence**
- `config/config.yml:9`
- `config/config.development.yml:9`

**Recommendation**
Default to `"false"`; require explicit opt-in for non-prod environments.

---

## F25 — Hardcoded dev admin password

**Severity:** Low · **Category:** Security · **Effort:** S

**Description**
```ruby
# config/tasks/dev.rake:21, 44
default_password = "P@ssword01" # default admin password
password = "P@ssword01"
```

**Impact**
If `rake dev:setup` or `rake dev:users` is accidentally run in a non-dev environment, the admin account gets a known weak password.

**Evidence**
- `config/tasks/dev.rake:21, 44`

**Recommendation**
Guard these tasks with `raise "dev only" unless ENV["APP_ENVIRONMENT"] == "development"`.

---

## F26 — `password_reset_token` column not unique / not indexed

**Severity:** Low · **Category:** Security / Performance · **Effort:** S

**Description**
```ruby
# db/migrations/20250714000000_create_initial_schema.rb:21
column :password_reset_token, String, null: true
```

**Impact**
- Lookups by `password_reset_token` (`AccountPassword::Service#reset_password`, `token_valid?`) are full-scan without an index.
- No uniqueness constraint means a (vanishingly unlikely) token collision would silently match the first row.

**Evidence**
- `db/migrations/20250714000000_create_initial_schema.rb:21`

**Recommendation**
Add `index: true, unique: true` to the column (and to `invitation_token`, which is already indexed — see migration `20260114000000`).

---

## F27 — Swallowed exception in `Auth::SimpleExpo#refresh`

**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/expo/auth/simple_expo.rb:79-82
rescue BadRefreshTokenError, Verse::Error::Authorization => e
  set_refresh_cookie(nil)
  e
end
```

**Impact**
The rescued exception object is returned as the response body. Depending on the renderer, this either renders the exception as JSON (leaking the message) or raises a downstream error. The intent appears to be "clear the cookie and re-raise", but the `e` at the end is a return value, not a `raise`.

**Evidence**
- `app/expo/auth/simple_expo.rb:79-82`

**Recommendation**
Replace `e` with `raise e` (or `raise`), or render a proper error response.

---

## F28 — `join` route/input parameter mismatch

**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/expo/accounts_expo.rb:36-41
expose on_http(:patch, "/:token/join", auth: nil) do
  input do
    field :token, String
  end
end
```

The route captures `:token` from the path, but `input` also declares `:token` as a body field. Verse's behavior here is unclear — the spec (`accounts_expo_spec.rb:101-109`) patches the service and never verifies which source `params[:token]` comes from.

**Evidence**
- `app/expo/accounts_expo.rb:36-41`

**Recommendation**
Pick one source (prefer body for security — see F12) and align the route/input declaration.

---

## F29 — Default `items_per_page: 1000` for account index

**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/service/account/service.rb:11
def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
```

**Impact**
A caller can request up to 1000 accounts in a single response, with no upper bound enforced at the exposition layer.

**Evidence**
- `app/service/account/service.rb:11`
- Same pattern in `AccountSession::Service:7`, `Organization::Service:7`, `ApiKey::Service:12` (100 there).

**Recommendation**
Cap `items_per_page` at a reasonable maximum (e.g. 100) and clamp the input.

---

## F30 — `Sequel.lit` with JSON parameterization

**Severity:** Low · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/model/account.rb:46-50
custom_filter :with_role_scope do |collection, role_scope|
  role_scope = role_scope.to_json unless role_scope.is_a?(String)
  collection.where(Sequel.lit("role_scope @> ?", role_scope))
end
```

**Impact**
`Sequel.lit` with a single bind parameter is safe here (the `?` is parameterized), but the pattern is fragile — any future edit that interpolates into the SQL string becomes an injection vector. The same applies to `app/model/api_key.rb:129-135`.

**Evidence**
- `app/model/account.rb:42-50`
- `app/model/api_key.rb:120-136`

**Recommendation**
Prefer Sequel's native JSONB operators (`Sequel.pg_jsonb(...)`) over `Sequel.lit`.

---

## F31 — `AccountSessionsExpo` relies on repo-level scoping only

**Severity:** Info · **Category:** Architecture · **Effort:** S

**Description**
`AccountSessionsExpo` (`app/expo/account_sessions_expo.rb`) declares `index` and `delete` with no exposition-level auth check. It relies entirely on `AccountSession::Repository` — which **does not override `scoped(action)`** (see `app/model/account_session.rb:19-98`). The repository defines custom methods (`logout`, `check_seq`, `bump_refresh_seq`) but inherits the default `scoped` from `Verse::Sequel::Repository`.

**Impact**
The default `scoped` behavior is unknown without reading verse-sequel source. If the default is "system/all", any authenticated user can list and delete any other user's sessions.

**Evidence**
- `app/expo/account_sessions_expo.rb:13-21`
- `app/model/account_session.rb:19-98` (no `scoped` override)

**Recommendation**
Implement `scoped(action)` in `AccountSession::Repository` to restrict sessions to those owned by the current account (with admin override).

---

## F32 — `OrganizationsExpo` registered twice

**Severity:** Info · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# config/routes.rb:3-14
Verse.on_boot do
  [
    HealthcheckExpo,
    OrganizationsExpo,
    AccountsExpo,
    AccountSessionsExpo,
    Auth::SimpleExpo,
    Account::PasswordsExpo,
    OrganizationsExpo,   # <-- duplicate
    ApiKeysExpo,
    Auth::ApiExpo,
  ].each(&:register)
end
```

**Impact**
Harmless if `register` is idempotent, but indicates copy-paste error.

**Evidence**
- `config/routes.rb:6, 11`

**Recommendation**
Remove the duplicate.

---

## F33 — Stale TODO in `Account::Repository`

**Severity:** Info · **Category:** CodeSmell · **Effort:** S

**Description**
```ruby
# app/model/account.rb:37
# TODO: scope for account creation might neede to be created and checked for different creator's account role
```

**Impact**
Indicates an unfinished security review of the create scope. Typo "neede".

**Evidence**
- `app/model/account.rb:37`

**Recommendation**
Resolve the TODO or convert to a tracked issue.

---

## F34 — Mixed `use_repo` / `use_system_repo` / `use` / `use_service` DSL

**Severity:** Info · **Category:** CodeSmell · **Effort:** S

**Description**
Different services use different DSL methods:

- `Account::Service`: `use` + `use_system`
- `Auth::Service`: `use_repo` + `use_system_repo`
- `ApiKey::Service`: `use_repo` + `use_system_repo`
- `AccountPassword::Service`: `use` + `use_system`
- `AccountSession::Service`: `use`
- `Organization::Service`: `use`

**Impact**
Inconsistency suggests API drift between Verse versions or copy-paste from different examples. Harder to grep for "all places that bypass auth scope".

**Evidence**
- Multiple service files.

**Recommendation**
Standardize on one DSL (`use_repo` / `use_system_repo` reads clearer).

---

## Additional Observations (no separate finding IDs)

- **`dev-entrypoint.sh`** runs `bundle exec rake db:setup db:migrate` on every container start. `db:setup` runs `db:create db:schema:load db:seed` — in production this can destroy data if `DATABASE_URI` is misconfigured. Confirm `db:setup` is gated by environment.
- **`config/puma.rb`** uses `preload_app!` and `before_fork { GC.compact }` — fine, but `Verse.event_manager.restart` in `on_worker_boot` should be wrapped in error handling; if Redis is down at worker boot, the worker crashes silently.
- **`app/service/auth/service.rb:99`** builds a role name as `"api:#{api_key.permissions.join(",")}"` — if `permissions` is empty (prevented by `ApiKey::Service#create:42`), this produces `"api:"` which would fail the `system_roles.find_by` lookup. Defense-in-depth: guard against empty permissions here too.
- **`app/model/account_session.rb:81-92`** publishes `"iam:account:login"` (singular `account`) while the resource constant is `Resource::Iam::Accounts` (plural). Inconsistent event channel naming.
- **`app/service/auth/service.rb:104-114`** — the API auth token is encoded with `labels: ["api"]` but no `role_scope` validation against the account's actual scope. The scope comes entirely from `api_key.build_scope`. Confirm the `api_service` account itself has no privileged role_scope that could leak.
- **`app/expo/auth/api_expo.rb:9`** — `login_api` accepts an arbitrary `token_expiration` with no upper bound. A caller can request a 10-year token. Cap it server-side.
- **`db/migrations/20250714000000_create_initial_schema.rb:42-61`** — `account_sessions` table has no index on `(account_id, nonce)` or `(account_id, id, nonce)`, used by `check_seq`.
- **`app/model/account.rb:64`** — `scoped(:login).where(email:)` uses Ruby's implicit-hash-as-named-args; verify Sequel interprets this correctly (it does, but the style is unusual).

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High     | 6 |
| Medium   | 13 |
| Low      | 8 |
| Info     | 4 |
| **Total**| **34** |

## Recommended Priority Order

1. **F01** (reset token in response) — trivial fix, critical impact.
2. **F02** (login uses scoped repo) — likely broken or leaky depending on role config.
3. **F03** (account enumeration) — trivial fix.
4. **F04** (shared repo in `RefreshToken`) — thread-safety + auth-context leak.
5. **F06** (role escalation via update) — privilege escalation.
6. **F09** (reset token reuse) — token oracle + race.
7. **F05, F07, F08** — defense-in-depth hardening.
8. Everything else in any order.
