# Audit: Notification & Setting Services

**Status: complete.** Both services reviewed.

## Executive Summary

The **Notification** service is a small event-driven email delivery worker: it subscribes to `notification:email` events (via the canonical `Service::Notification::SEND_EMAIL_CHANNEL` constant), looks up the recipient account via the IAM inter-service API, checks the recipient's per-category notification preferences via the Setting service, renders an ERB template, and delivers via SMTP using the `mail` gem. The **Setting** service exposes account-level settings (per-user notification preferences and arbitrary plugin-scoped key/value pairs), a system-level settings table, and a plugin management API that lists modalities and serves plugin static assets and entry-point files; plugin *loading* (Zeitwerk-based Ruby code execution from disk) is delegated to the shared `PluginSystem` in `common/`.

Both services are tiny, but each carries meaningful risk. The Notification service has clear security gaps: unescaped user-controlled data in every HTML email template (stored XSS reaching user inboxes), no validation of the recipient address (CRLF/header injection), account enumeration via a distinguishable "not found" error, and a blocking `Mail.deliver` call on the event dispatcher with no SMTP timeout, no error handling, and no dead-letter. The Setting service's most security-sensitive surface is the plugin file-serving API: the `serve_asset` endpoint has an incomplete path-traversal guard (only checks literal `".."`/`"."` segments, misses encoded and other traversal forms), the `serve_file` endpoint has no traversal guard at all (mitigated only by an implicit filename allowlist), and the `serve_asset`/`serve_file` endpoints plus `modalities`/`show_modality` are all exposed with `auth: nil` (anonymous). Account-settings scoping has a real bug: the `own?` branch returns the unfiltered table for `:create` (any authenticated user can create settings rows for *any* `account_id`), and the `AccountSettings::Service#create` method itself bypasses the auth context entirely by passing a raw `account_id` from an event payload straight into the repository. There is also dead/misleading code (`Plugins::Manager` is a half-built thread-queue with no producer, `Settings::Service` is empty, `PluginLifecycleContext` is a no-op stub, `puma.rb` references `::SCHEDULER`/`::EXECUTOR` that don't exist in this service), and the `plugins` table has no uniqueness constraint on `(name, version)`.

## Findings Table

| ID | Severity | Category | Service | File:Line | Title |
|----|----------|----------|---------|-----------|-------|
| N-01 | High | Security | Notification | `app/service/email/service.rb:31-35` | No validation of `to_email` / `notification.title` (CRLF / header injection) |
| N-02 | High | Security | Notification | `app/service/email/templates/*.html.erb` | Unescaped user-controlled data in HTML email templates (stored XSS) |
| N-03 | High | Security | Notification | `app/service/email/service.rb:14-16` | Account enumeration via distinguishable "not found" error |
| N-04 | High | Performance | Notification | `app/service/email/service.rb:48` + `config/initializers/mailer.rb` | Blocking SMTP `Mail.deliver` on event dispatcher with no timeout |
| N-05 | Medium | Performance | Notification | `app/service/email/service.rb:8-23` | Two sequential inter-service HTTP calls per email, no caching |
| N-06 | Medium | CodeSmell | Notification | `app/service/email/service.rb:32` | Hardcoded sender string; no centralized email config |
| N-07 | Medium | Security | Notification | `config/initializers/mailer.rb:16-23` | Dev SMTP has no auth/TLS; relies on env-only |
| N-08 | Low | CodeSmell | Notification | `app/expo/emails_expo_spec.rb:28` | Spec hardcodes channel string `"notification:email"` instead of `Service::Notification::SEND_EMAIL_CHANNEL` |
| N-09 | Low | CodeSmell | Notification | `app/service/email/service.rb:25-27` | `fetch(notification.type, true)` defaults to sending (fail-open) |
| N-10 | Low | CodeSmell | Notification | `app/service/email/renderer.rb:14-32` | Template lookup swallows missing partials; raises generic `RuntimeError` |
| N-11 | Low | CodeSmell | Notification | `app/service/email/service.rb:48` | No error handling around `Mail.deliver` — delivery failures propagate raw |
| N-12 | Low | Performance | Notification | `app/service/email/service.rb:31-48` | New `Mail`/`Mail::Part` per send; no SMTP connection pooling |
| N-13 | Info | CodeSmell | Notification | `app/service/email/templates/account_created.html.erb:4` | Typo "Your invited" → "You're invited" |
| N-14 | Info | Architecture | Notification | `db/migrations/20251114000000_create_initial_schema.rb` | No notification log table; no audit trail of sent emails |
| N-15 | Info | CodeSmell | Notification | `app/service/email/renderer.rb:18` | Template path not validated against `TEMPLATE_PATH` root (defence-in-depth) |
| S-01 | High | Security | Setting | `app/expo/plugins_expo.rb:54-79` | `serve_asset` path-traversal guard is incomplete (only literal `..`/`.` segments) |
| S-02 | High | Security | Setting | `app/expo/plugins_expo.rb:81-109` | `serve_file` has no path-traversal guard; relies on implicit filename allowlist |
| S-03 | High | Security | Setting | `app/expo/plugins_expo.rb:19-52` | `modalities` and `show_modality` endpoints are `auth: nil` (anonymous) |
| S-04 | High | Security | Setting | `app/model/account_setting.rb:23-33` | `own?` scope returns unfiltered table for `:create` — any user can create rows for any `account_id` |
| S-05 | High | Architecture | Setting | `app/service/account_settings/service.rb:22-34` | `Service#create`/`delete` bypass auth context — `account_id` from event payload used directly |
| S-06 | High | Security | Setting | `app/service/plugins/service.rb:32-50` | `serve_asset` reads file with no MIME/size cap; returns raw `File` IO to anonymous callers |
| S-07 | Medium | Security | Setting | `app/model/plugin.rb:19-35` + `app/service/plugins/service.rb:13-30` | Plugin discovery trusts on-disk `manifest.json` (RCE via `Plugin#start` in common) — no signature/allowlist |
| S-08 | Medium | Security | Setting | `db/migrations/20250928000000_create_initial_schema.rb:34-47` | `plugins` table has no uniqueness constraint on `(name, version)`; `source_path` unchecked |
| S-09 | Medium | Architecture | Setting | `app/service/plugins/manager.rb:1-24` | `Plugins::Manager` is dead/broken: module methods on `self` won't work as written; never started |
| S-10 | Medium | Architecture | Setting | `app/service/settings/service.rb:1-5` | `Settings::Service` is empty — `SettingsExpo` registers but exposes nothing; system settings have no CRUD API |
| S-11 | Medium | Architecture | Setting | `app/util/plugin_lifecycle_context.rb:1-15` | `PluginLifecycleContext` is a no-op stub — `mount_plugin`/`unmount_plugin` do nothing |
| S-12 | Medium | Architecture | Setting | `config/puma.rb:17-19` | `on_worker_boot` references `::SCHEDULER` and `::EXECUTOR` which are undefined in this service |
| S-13 | Medium | Performance | Setting | `app/service/account_settings/service.rb:7` | `items_per_page: 1000` default — unbounded-feeling pagination |
| S-14 | Medium | CodeSmell | Setting | `app/service/plugins/service.rb:99-142` | `serve_file` has duplicate `return nil if file_path.nil?` / `return unless file_path` and no `File.exist?` check before `File.read` |
| S-15 | Medium | CodeSmell | Setting | `app/service/plugins/service.rb:13-30` | `find` does `Dir.glob` on every call (no caching); globs a config-derived path that may contain `;`-separated globs |
| S-16 | Low | CodeSmell | Setting | `app/model/account_setting.rb:46-63` | `set` uses `Sequel.lit("?::jsonb", value.to_json)` — raw SQL fragment; safe here but fragile pattern |
| S-17 | Low | CodeSmell | Setting | `app/expo/plugins_expo.rb:86-97` | Anonymous renderer class defined inline with `Class.new` — untestable, captures `server.request.env` stringly |
| S-18 | Low | CodeSmell | Setting | `app/model/plugin.rb:50` | Typo `curent_plugin_name` (should be `current_plugin_name`) |
| S-19 | Low | CodeSmell | Setting | `app/service/plugins/service.rb:137` | Redundant `return unless file_path` immediately after `return nil if file_path.nil?` |
| S-20 | Low | Architecture | Setting | `app/expo/account_settings_expo.rb:23-31` | Event handlers use raw strings `"iam:accounts"` / `"created"` / `"deleted"` instead of `Resource::Iam::Accounts` constant |
| S-21 | Low | CodeSmell | Setting | `app/service/plugins/service.rb:7-11` | `install` calls `Manager.run { install_plugin }` but `install_plugin` is undefined — `NameError` at runtime |
| S-22 | Info | CodeSmell | Setting | `app/expo/plugins_expo.rb:6-9` | Stale French/English comments describing routes that don't match the implemented `expose on_http` paths |
| S-23 | Info | Architecture | Setting | `db/migrations/20250928000000_create_initial_schema.rb:49-60` | Commented-out `plugin_images` table — dead schema intent |
| S-24 | Info | CodeSmell | Setting | `app/service/plugins/service_spec.rb:18,57` | Specs `puts last_response.body` left in tests (debug noise) |
| S-25 | Info | CodeSmell | Setting | `app/setting/Gemfile:29` | `rmagick` dependency present but unused in any `.rb` file in this service (likely copy-paste from media service) |

## Notification Findings

### N-01 — No validation of `to_email` / `notification.title` (CRLF / header injection)

- **Description**: `EmailsExpo#on_send_email` only checks that `content[:account_email]` is present (`app/expo/emails_expo.rb:10-12`). The value is passed straight into `Mail.new { to to_email }` in `Email::Service#send_email` (`app/service/email/service.rb:33`), and `notification.title` is passed straight into `subject` (`service.rb:34`). Neither is validated for well-formedness or CRLF. The `mail` gem will accept comma-separated lists and, depending on version, may pass through raw header bytes. Because both fields originate from a Redis pub/sub event payload that any authenticated publisher can craft (see `common/lib/service/notification.rb`), a malicious publisher can inject additional `To`/`Cc`/`Bcc` recipients or break out of the `Subject` header via `\r\n`.
- **Impact**: An attacker who can publish to `notification:email` can send mail to arbitrary recipients not present in IAM, or smuggle extra headers. Combined with N-03, the IAM lookup is bypassable by injecting multiple addresses (the first valid one is returned by `.first`, the rest are delivered).
- **Evidence**:
  ```ruby
  # app/service/email/service.rb:31-35
  mail = Mail.new do
    from    "Idah Notification <no-reply@idah.ingedata.ai>"
    to      to_email            # ← raw, unvalidated
    subject notification.title  # ← raw, unvalidated
  end
  ```
- **Recommendation**: Validate `to_email` with a strict single-address regex (e.g. `URI::MailTo::EMAIL_REGEXP`) and reject if it contains `,`, `;`, `\r`, or `\n`. Apply the same CRLF rejection to `notification.title` before assigning `subject`. After the IAM lookup, assert the IAM account's email equals `to_email`.
- **Effort**: S

### N-02 — Unescaped user-controlled data in HTML email templates (stored XSS)

- **Description**: Every `.html.erb` template interpolates notification fields with raw `<%= ... %>` rather than `<%= h(...) %>` / `ERB::Util.html_escape`. Fields like `notification.project_name`, `notification.organization_name`, `notification.inviter_name`, `notification.changed_by_name`, `notification.dataset_name`, and `notification.title` (in `partials/header.html.erb:5`) all originate from event payloads published by other services. A project named `<script>...</script>` or `<img src=x onerror=...>` will be rendered verbatim into the HTML body.
- **Impact**: Stored XSS reaching users' email clients. Many webmail clients (Gmail, Outlook on the web) execute sanitised but still-dangerous HTML; CSS injection and link rewriting enable phishing inside a trusted branded email. The `title` field also flows into the `<title>` tag and the `Subject` header (N-01).
- **Evidence**:
  ```erb
  <!-- app/service/email/templates/project_member_added.html.erb -->
  <h1>You have been assigned to project "<%= notification.project_name %>"</h1>
  ...
  by <%= notification.inviter_name %>.
  <!-- app/service/email/templates/partials/header.html.erb:5 -->
  <title><%= notification.title %></title>
  ```
- **Recommendation**: Use `ERB::Util.html_escape` (or `h`) for every interpolation in `.html.erb` templates. Introduce a small helper module mixed into the renderer's binding and audit each template. Consider an allowlist of permitted tags if any field is meant to carry HTML.
- **Effort**: M

### N-03 — Account enumeration via distinguishable "not found" error

- **Description**: When `Api[:idah].iam.accounts.index(filter: { email: to_email })` returns no rows, the service raises `Verse::Error::NotFound, "Account not found for email: #{to_email}"` (`app/service/email/service.rb:14-16`). The error message echoes the supplied email. Any service that publishes an event with an arbitrary email can distinguish "no such account" from "account exists but notification suppressed" — a classic account-existence oracle.
- **Impact**: An attacker who can publish (or trigger) notification events can enumerate which email addresses are registered in IAM. The echoed email also leaks the probe value into logs.
- **Evidence**:
  ```ruby
  unless account
    raise Verse::Error::NotFound, "Account not found for email: #{to_email}"
  end
  ```
- **Recommendation**: Treat a missing account the same as a disabled notification: log internally at warn level and return silently from the public handler. Do not surface the email in the error message.
- **Effort**: S

### N-04 — Blocking SMTP `Mail.deliver` on event dispatcher with no timeout

- **Description**: `Mail.deliver(mail)` (`app/service/email/service.rb:48`) performs a synchronous SMTP transaction on whatever thread the event dispatcher handed the handler off on. The `mailer.rb` initializer (`config/initializers/mailer.rb`) configures no `open_timeout`, no `read_timeout`, no `openssl_verify_mode`, and no retry. A slow or blackholing SMTP server will hold the worker thread indefinitely (the `mail` gem defaults to no socket timeout).
- **Impact**: A single unreachable SMTP host can stall the notification worker pool and back up the Redis event queue, delaying all notifications system-wide. There is no circuit breaker and no dead-letter — the email is just lost if `Mail.deliver` raises.
- **Evidence**:
  ```ruby
  # config/initializers/mailer.rb
  Mail.defaults do
    delivery_method(:smtp,
      address: ENV.fetch("MAIL_SMTP_HOST"),
      port: ENV.fetch("MAIL_SMTP_PORT"),
      user_name: ENV.fetch("MAIL_SMTP_USER"),
      password: ENV.fetch("MAIL_SMTP_PASSWORD"),
      authentication: "login",
      enable_starttls_auto: true)
    # ← no open_timeout / read_timeout
  end
  ...
  Mail.deliver(mail)  # blocking, no rescue, no timeout
  ```
- **Recommendation**: Set `open_timeout:` and `read_timeout:` (e.g. 10s each) in `Mail.defaults`. Wrap `Mail.deliver` in a `Timeout.timeout` or move delivery to a dedicated worker pool with a bounded queue and a dead-letter table. Rescue `Net::SMTPError` and log/retry rather than letting it propagate to the event dispatcher.
- **Effort**: M

### N-05 — Two sequential inter-service HTTP calls per email, no caching

- **Description**: For every email, `send_email` makes a synchronous `Api[:idah].iam.accounts.index` call (`service.rb:8-12`) and then a synchronous `Api[:idah].setting.account_settings.index` call (`service.rb:18-23`). Both are full HTTP round-trips with no local cache. Account notification preferences change rarely.
- **Impact**: Doubles per-email latency, adds two failure modes per email, and amplifies N-04's blast radius (a Setting service outage stops all notifications). Under load this serialises delivery.
- **Evidence**: see `service.rb:8` and `service.rb:18`.
- **Recommendation**: Cache account notification preferences in Redis with a short TTL (e.g. 5 min) keyed by `account_id`, or pass the relevant preferences in the event payload from the publisher (which already knows the account). At minimum, parallelise the two calls with concurrent-ruby.
- **Effort**: M

### N-06 — Hardcoded sender string; no centralized email config

- **Description**: The `from` address `"Idah Notification <no-reply@idah.ingedata.ai>"` is hardcoded in `service.rb:32`. The display name, the from domain, and the reply-to are not configurable. There is no `Reply-To` header set.
- **Impact**: Cannot deploy this service to a different brand/tenant without code changes; SPF/DKIM alignment is hardcoded.
- **Evidence**: `from "Idah Notification <no-reply@idah.ingedata.ai>"`
- **Recommendation**: Move sender config to env vars (`MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`) read in `mailer.rb` and inject into the service.
- **Effort**: S

### N-07 — Dev SMTP has no auth/TLS

- **Description**: In `development`, `mailer.rb:16-23` configures SMTP with only `address` and `port` — no `authentication`, no `enable_starttls_auto`, no `openssl_verify_mode`. The `MAIL_SMTP_HOST` env var is `fetch`ed (raises if missing) but nothing prevents pointing at an arbitrary host.
- **Impact**: Development emails can be MITM'd or redirected; if dev config is accidentally promoted, production credentials could be sent to an unauthenticated relay. Lower severity because it's dev-only, but the initializer pattern invites copy-paste mistakes.
- **Evidence**: see `mailer.rb:16-23`.
- **Recommendation**: At minimum set `enable_starttls_auto: true` in dev too, and document that dev should point at MailHog (localhost only). Consider failing fast if `MAIL_SMTP_HOST` is not loopback in development.
- **Effort**: S

### N-08 — Spec hardcodes channel string instead of `Service::Notification::SEND_EMAIL_CHANNEL`

- **Description**: `EmailsExpo` correctly subscribes via `expose on_event(Service::Notification::SEND_EMAIL_CHANNEL)` (`emails_expo.rb:6`) — the canonical constant defined in `common/lib/service/notification.rb`. However, the spec publishes with the raw string `"notification:email"` (`emails_expo_spec.rb:28`). If the constant's value ever changes, the spec will still pass while production breaks (or vice versa).
- **Impact**: Channel-name drift between spec and production; the spec does not exercise the actual constant.
- **Evidence**:
  ```ruby
  # app/expo/emails_expo_spec.rb:28
  Verse.publish("notification:email", message_content)
  ```
- **Recommendation**: Use `Service::Notification::SEND_EMAIL_CHANNEL` in the spec's `Verse.publish` call.
- **Effort**: S

### N-09 — `fetch(notification.type, true)` defaults to sending (fail-open)

- **Description**: `send_email_categories.fetch(notification.type, true)` (`service.rb:25-27`) returns `true` when the user has no preference recorded for the notification type. The boolean is then used directly as `send_email`.
- **Impact**: A user who has never touched their notification preferences will receive every notification type, even ones that should arguably default to off. Fail-open is a privacy/UX concern rather than a security one, but it is the opposite of least-surprise. Note `AccountSettings::Defaults::DEFAULT_ACCOUNT_SETTINGS` only defines two keys.
- **Evidence**: `send_email = send_email_categories.fetch(notification.type, true)`
- **Recommendation**: Look up explicit per-type defaults from `AccountSettings::Defaults` rather than blanket-defaulting to `true`. At minimum, document the policy.
- **Effort**: S

### N-10 — Template lookup swallows missing partials; raises generic `RuntimeError`

- **Description**: `Email::Renderer#render` (`renderer.rb:14-32`) iterates `["default", notification.category.to_s]` and `next`s unless the content template exists. If neither exists it raises a bare `raise "No template found for #{notification.category}"` (a `RuntimeError`). The partials (header/footer) are read without existence checks (`renderer.rb:19-20`) — if a partial is missing, `File.read` raises `Errno::ENOENT` with a confusing message.
- **Impact**: A new notification category with no template yields an opaque `RuntimeError` in the event handler; missing partials yield `Errno::ENOENT`. Both are unhandled and surface as dispatcher errors.
- **Evidence**:
  ```ruby
  content_template = ERB.new(::File.read(content)).result(binding)
  header_template  = ERB.new(::File.read(header)).result(binding)   # no existence check
  ...
  raise "No template found for #{notification.category}"
  ```
- **Recommendation**: Raise a typed `Verse::Error::NotFound` (or a domain-specific `Email::TemplateMissing`) with the category name. Check partial existence with `File.exist?` and fail loudly with a clear message.
- **Effort**: S

### N-11 — No error handling around `Mail.deliver`

- **Description**: `Mail.deliver(mail)` (`service.rb:48`) is called without any `rescue`. Any SMTP error (`Net::SMTPAuthenticationError`, `Net::SMTPServerBusy`, `Errno::ECONNREFUSED`, `Timeout::Error`) propagates up through `EmailsExpo#on_send_email` into the event dispatcher. There is no retry, no dead-letter, no metric.
- **Impact**: Transient SMTP failures lose the notification entirely. Operators have no visibility into delivery failures.
- **Evidence**: see `service.rb:48` — no `rescue`, no `begin`.
- **Recommendation**: Wrap delivery in a `rescue StandardError => e`, log with the notification id and recipient, and either re-raise into a retry queue or persist a failed-delivery record. Emit a metric.
- **Effort**: M

### N-12 — New `Mail`/`Mail::Part` per send; no SMTP connection pooling

- **Description**: Each `send_email` call builds `Mail.new`, two `Mail::Part.new`, and calls `Mail.deliver`, which opens a fresh TCP+TLS+AUTH SMTP connection. There is no persistent SMTP session reuse.
- **Impact**: Under load this multiplies SMTP handshakes (and STARTTLS round-trips), increasing latency and load on the SMTP relay. Combined with N-04 (no timeout) this also multiplies the number of threads that can be stuck.
- **Evidence**: `service.rb:31-48`.
- **Recommendation**: If volume warrants, switch to a pooled SMTP delivery method (e.g. a long-lived `Mail::SMTP` instance, or a sidekiq-style worker). For low volume this is acceptable — flag as Info if volume is known to be low.
- **Effort**: L

### N-13 — Typo "Your invited" in account_created template

- **Description**: `templates/account_created.html.erb:4` and `account_created.text.erb:1` say "Your invited to join IDAH" instead of "You're invited".
- **Impact**: Cosmetic, but appears in every account-creation email.
- **Evidence**: `<h1>Your invited to join IDAH</h1>`
- **Recommendation**: Fix to "You're invited to join IDAH".
- **Effort**: S

### N-14 — No notification log table; no audit trail of sent emails

- **Description**: The only migration (`20251114000000_create_initial_schema.rb`) installs `pg_trgm` and an `updated_at` function. There is no `notifications` or `email_log` table. The service has no `app/model/` directory at all.
- **Impact**: No way to answer "did this user receive this notification?" or to retry after an SMTP outage. No metrics source besides logs.
- **Evidence**: `db/migrations/20251114000000_create_initial_schema.rb` is the only migration; `app/model/` does not exist.
- **Recommendation**: Consider a `sent_emails` table (id, account_id, category, type, sent_at, status, error) written around `Mail.deliver`. This also enables N-11's dead-letter.
- **Effort**: M

### N-15 — Template path not validated against `TEMPLATE_PATH` root

- **Description**: `Email::Renderer#render` constructs `File.join(TEMPLATE_PATH, "#{pattern}.#{type}.erb")` where `pattern` comes from `notification.category.to_s`. Currently `pattern` is one of two literal strings (`"default"` or the category), so traversal is not reachable. However, if a future caller passes a category containing `..`, `File.join` will happily escape `TEMPLATE_PATH`.
- **Impact**: Defence-in-depth gap; not currently exploitable.
- **Evidence**: `content = ::File.join(TEMPLATE_PATH, "#{pattern}.#{type}.erb")`
- **Recommendation**: Validate that `pattern` matches `\A[\w-]+\z` before joining, or use `File.expand_path` and assert the result starts with `TEMPLATE_PATH`.
- **Effort**: S

## Setting Findings

### S-01 — `serve_asset` path-traversal guard is incomplete

- **Description**: `PluginsExpo#serve_asset` (`app/expo/plugins_expo.rb:65-79`) attempts to prevent directory traversal with:
  ```ruby
  if params[:splat].any?{ |part| ["..", "."].include?(part) }
    return server.not_found
  end
  ```
  This only rejects splat segments that are *exactly* `".."` or `"."`. It does not reject URL-encoded forms (`%2e%2e`, `%2e`), segments containing trailing characters (`".."` + something), backslash-separated paths on platforms that normalise them, or a single leading `/`. The splat is then joined with `/` and passed to `Plugins::Service#serve_asset`, which does `File.join(plugin.path, assets_directory, filename)` with no further validation (`app/service/plugins/service.rb:41-45`). `assets_directory` itself comes from the on-disk manifest and is not sanitised.
- **Impact**: An anonymous caller (the endpoint is `auth: nil`, see S-03) can potentially read arbitrary files inside the plugin directory tree, and — if `assets_directory` in a planted manifest contains `..` — files outside it. Combined with S-06 (raw `File.open` returned), this is a direct arbitrary-file-read primitive.
- **Evidence**:
  ```ruby
  # app/expo/plugins_expo.rb:66-74
  if params[:splat].any?{ |part| ["..", "."].include?(part) }
    return server.not_found
  end
  io = service.serve_asset(
    params[:plugin],
    params[:splat].join("/")
  )
  # app/service/plugins/service.rb:41-45
  asset_path = File.join(plugin.path, assets_directory, filename)
  return nil unless File.exist?(asset_path)
  File.open(asset_path, "rb")
  ```
- **Recommendation**: After joining, compute `File.expand_path(asset_path)` and assert `asset_path.start_with?(File.expand_path(plugin.path) + "/")`. Reject any splat segment matching `/(\.\.|\A\.|%2e|%2E)/`. Do not rely on a denylist of two literal strings.
- **Effort**: S

### S-02 — `serve_file` has no path-traversal guard

- **Description**: `PluginsExpo#serve` (`app/expo/plugins_expo.rb:104-109`) passes `params[:filename]` straight to `service.serve_file` with no traversal check at all — unlike `serve_asset`. `serve_file` (`app/service/plugins/service.rb:99-142`) only acts on a fixed set of filenames (`plugin.js`, `plugin.css`, `details.js`, `details.css`, `dataset_config.json`, `plugin_shortcut.json`), so direct traversal via `filename` is blocked by the implicit allowlist. However, the *resolved* `file_path` comes from the manifest (`entry_plugin.script`, `entry_details.style`, etc.) and is joined as `File.join(plugin.path, file_path)` with no containment check (`service.rb:139-141`). A planted/modified manifest with `"script": "../../../../etc/passwd"` would be served.
- **Impact**: Defence-in-depth gap; if a plugin manifest is tampered with (see S-07), arbitrary file read is possible via the `serve_file` endpoint, which is also `auth: nil`.
- **Evidence**:
  ```ruby
  # app/expo/plugins_expo.rb:104-109 — no traversal check
  def serve
    service.serve_file(params[:plugin], params[:filename]) || server.not_found
  end
  # app/service/plugins/service.rb:139-141
  File.read(File.join(plugin.path, file_path))
  ```
- **Recommendation**: Apply the same `File.expand_path` + `start_with?` containment check used in S-01's recommendation. Validate manifest `entry_points.*` paths against `\A[\w./-]+\z` and reject `..` when loading the manifest.
- **Effort**: S

### S-03 — `modalities` and `show_modality` endpoints are `auth: nil` (anonymous)

- **Description**: All four `PluginsExpo` HTTP endpoints are declared with `auth: nil`: `modalities` (`plugins_expo.rb:19-23`), `show_modality` (`:35-39`), `serve_asset` (`:54-58`), and `serve` (`:81-85`). The two modality endpoints expose the full plugin catalogue (names, labels, descriptions, supported shapes) to unauthenticated callers. The two file endpoints expose plugin static assets and entry-point JS/CSS/JSON to unauthenticated callers.
- **Impact**: Information disclosure of the plugin inventory to anonymous users, which is useful reconnaissance for targeting specific plugins. The file-serving endpoints being anonymous compounds S-01/S-02. Whether this is intentional (the frontend needs them unauthenticated) should be confirmed, but at minimum the modality catalogue need not be public.
- **Evidence**:
  ```ruby
  expose on_http(:get, "modalities", auth: nil) do ... end
  expose on_http(:get, "modalities/:modality_name", auth: nil) do ... end
  expose on_http(:get, ":plugin/assets/*", auth: nil, ...) do ... end
  expose on_http(:get, ":plugin/files/:filename", auth: nil, ...) do ... end
  ```
- **Recommendation**: Require authentication for `modalities` and `show_modality`. If the frontend needs them pre-login, restrict to a known public subset. Keep file-serving anonymous only if strictly required, and gate it behind the containment checks in S-01/S-02.
- **Effort**: S

### S-04 — `own?` scope returns unfiltered table for `:create` — any user can create rows for any `account_id`

- **Description**: `AccountSetting::Repository#scoped` (`app/model/account_setting.rb:23-33`):
  ```ruby
  def scoped(action)
    auth_context.can!(action, self.class.resource) do |scope|
      scope.all? { table }
      scope.own? {
        table if action == :create        # ← returns unfiltered table for :create
        table.where(account_id: auth_context.metadata[:id])
      }
    end
  end
  ```
  For `:create`, the `own?` branch returns the bare `table` (no `where`), so the `account_id` filter is not applied. The `AccountSettings::Service#create` method (`app/service/account_settings/service.rb:22-34`) calls `account_settings.create(attributes)` with `attributes[:account_id]` taken from the event payload (see S-05), but even via the normal `update`/`create` HTTP path, an authenticated user with `own?` permission can insert rows for *any* `account_id` because the scope does not constrain it.
- **Impact**: Privilege escalation / cross-user tampering: a user can create or overwrite another user's notification preferences (e.g. disable security notifications for a victim, or enable noisy ones). The `set` query (`account_setting.rb:46-63`) uses `scoped(:update)` which *does* filter by `account_id`, so direct `set` is protected — but `create` is not.
- **Evidence**: see snippet above.
- **Recommendation**: For `:create`, return `table.where(account_id: auth_context.metadata[:id])` (or reject cross-account creates explicitly). The `if action == :create` special-case appears to be a bug; remove it and apply the `account_id` filter uniformly.
- **Effort**: S

### S-05 — `Service#create`/`delete` bypass auth context — `account_id` from event payload used directly

- **Description**: `AccountSettingsExpo` subscribes to `iam:accounts` created/deleted events (`app/expo/account_settings_expo.rb:23-31`) and calls `service.create(params[:resource_id])` / `service.delete(params[:resource_id])`. `AccountSettings::Service#create` (`app/service/account_settings/service.rb:22-34`) takes the `account_id` straight from the event payload and calls `account_settings.create(attributes)` and `account_settings.index({ account_id: })`. The repository's `scoped(:create)` returns the unfiltered table (S-04), so there is no auth-context check that the acting principal owns that `account_id`. The event handler runs as `:system` (per `spec_helper.rb` `Verse::Spec.add_user(:system, "system")`), which has `all?` scope, so in practice the system principal can write any account — but the *design* relies on the event payload being trustworthy. A forged `iam:accounts:created` event with an arbitrary `resource_id` would let the publisher create default settings rows for any account_id (low impact since they're just defaults) and, more importantly, `delete` (`service.rb:41-46`) iterates `account_settings.index({ account_id: })` and deletes every row — a forged `iam:accounts:deleted` event wipes an arbitrary user's settings.
- **Impact**: A publisher to the `iam:accounts:deleted` channel can wipe any user's account settings. The create path is lower-impact (defaults only) but still bypasses the auth boundary by design.
- **Evidence**:
  ```ruby
  # app/service/account_settings/service.rb:22-34, 41-46
  def create(account_id)
    Defaults::DEFAULT_ACCOUNT_SETTINGS.each do |key, value|
      account_settings.transaction do
        account_settings.create(account_id:, key:, value:)
      end
    end
  end
  def delete(account_id)
    settings = account_settings.index({ account_id: })
    settings.each { |setting| account_settings.delete(setting.id) }
  end
  ```
- **Recommendation**: Verify the event's publisher is trusted (the IAM service) via the event bus's auth/origin metadata. Do not let `delete` operate on an arbitrary `account_id` without confirming the corresponding account is actually being deleted (e.g. cross-check via IAM). At minimum, log every `create`/`delete` with the source event id for audit.
- **Effort**: M

### S-06 — `serve_asset` reads file with no MIME/size cap; returns raw `File` IO to anonymous callers

- **Description**: `Plugins::Service#serve_asset` (`app/service/plugins/service.rb:32-50`) opens the file with `File.open(asset_path, "rb")` and returns the raw `File` IO to the exposition, which streams it via `Verse::Http::Renderer::Binary`. There is no `Content-Type` set (the `serve_asset` endpoint uses the binary renderer with no content-type logic, unlike `serve_file` which has the inline `Class.new` renderer), no `Content-Length` cap, and no restriction on file type. Any file under `plugin.path/assets_directory` is served verbatim.
- **Impact**: Combined with S-01 (traversal) and S-03 (anonymous), this is an arbitrary-file-read primitive. Even without traversal, plugin authors can ship arbitrary binary files (e.g. `.exe`, `.html` served as `application/octet-stream` but still downloadable) that are served with no MIME sniffing protection (`X-Content-Type-Options: nosniff` not set).
- **Evidence**:
  ```ruby
  # app/service/plugins/service.rb:49
  File.open(asset_path, "rb")
  # app/expo/plugins_expo.rb:58
  renderer: Verse::Http::Renderer::Binary
  ```
- **Recommendation**: Set a MIME type from a safe allowlist based on extension (png/jpg/svg/js/css/json), reject unknown extensions, cap file size, and set `X-Content-Type-Options: nosniff` and a `Content-Disposition`. Apply the containment check from S-01.
- **Effort**: M

### S-07 — Plugin discovery trusts on-disk `manifest.json` (RCE via `Plugin#start` in common)

- **Description**: `Plugins::Service#find` (`app/service/plugins/service.rb:13-30`) and `Plugin::Record.from_path` (`app/model/plugin.rb:19-35`) read `manifest.json` from disk and trust its `entry_points.backend.path` and `entry_points.backend.module` fields. The shared `PluginSystem::Plugin#start` (`common/lib/plugin_system/plugin.rb:30-70`) then does:
  ```ruby
  path_to_code = File.join(@path, manifest.entry_points.backend.path, service_name)
  @loader = Zeitwerk::Loader.new
  @loader.push_dir(path_to_code)
  @loader.setup
  Object.const_get([manifest.entry_points.backend.module, service_class_name].join("::")).init(@context)
  ```
  i.e. it loads and executes arbitrary Ruby from the plugin directory. There is no signature check, no allowlist of permitted plugin names, and no sandboxing. The `IDAH_PLUGIN_PATH` env var (default `plugins/**`) controls where plugins are scanned from, and `config.yml` exposes it via `IDAH_PLUGIN_PATH`.
- **Impact**: Anyone who can write a file under `IDAH_PLUGIN_PATH` (or modify an existing plugin's `manifest.json`/backend code) gets arbitrary Ruby execution in the Setting service process on the next plugin restart. The Setting service's `PluginLifecycleContext` is a no-op stub (S-11), so there is no mount/unmount bookkeeping to detect rogue registrations. This is the single highest-impact risk in the audited scope, but the actual loading code lives in `common/` (out of scope here; flagged in `audit/01-common-library.md`).
- **Evidence**:
  ```ruby
  # app/model/plugin.rb:19-22
  def self.from_path(path)
    manifest = PluginSystem::Manifest.new(JSON.parse(File.read(File.join(path, "manifest.json"))))
  ```
- **Recommendation**: Treat plugins as trusted artefacts: sign manifests and verify signatures before loading, restrict `IDAH_PLUGIN_PATH` to a read-only directory owned by a deploy user (not the app user), and add an explicit allowlist of permitted plugin names in config. Run plugin `init` in a sandboxed context if possible. At minimum, log every plugin load with manifest hash.
- **Effort**: L

### S-08 — `plugins` table has no uniqueness constraint on `(name, version)`; `source_path` unchecked

- **Description**: The `plugins` migration (`db/migrations/20250928000000_create_initial_schema.rb:34-47`) defines `name` and `version` as indexed but not unique together. `source_path` is `null: false` but otherwise unconstrained. There is no constraint preventing two rows with the same `(name, version)` but different `source_path`.
- **Impact**: Ambiguity in plugin resolution — `Plugin::Record#path` (`app/model/plugin.rb:37-62`) for non-manual plugins globs the filesystem and matches `"#{name}-#{version}"`, so duplicate DB rows could point at different filesystem paths and confuse `serve_file`/`serve_asset`. Also a footgun for future install flows.
- **Evidence**:
  ```ruby
  create_table(:plugins) do
    column :source_type, String, null: false, index: true
    column :source_path, String, null: false
    column :name, String, null: false, index: true
    column :version, String, null: false
    # no unique index on [name, version]
  end
  ```
- **Recommendation**: Add `index %i[name version], unique: true` in a follow-up migration. Validate `source_path` is within an allowed root.
- **Effort**: S

### S-09 — `Plugins::Manager` is dead/broken: module methods on `self` won't work as written; never started

- **Description**: `Plugins::Manager` (`app/service/plugins/manager.rb`) is declared as `module Manager` with methods `start`, `stop`, `run`, `enqueue` defined as plain `def` (so they become *private instance* methods of the module), but they mutate `@queue` (an instance variable of the module object) and are called as if they were module methods. Without `extend self` or `module_function`, calling `Manager.run` from `Plugins::Service#install` (`service.rb:7-11`) will raise `NoMethodError: private method 'run' called for Plugins::Manager:Module`. Even if it worked, `@queue` is defined at the module level (`@queue = Queue.new`) which is a different ivar than the one the instance methods see. Nothing in `config/routes.rb`, `boot.rb`, or `puma.rb` starts this manager.
- **Impact**: `Plugins::Service#install` is unreachable dead code that will crash if ever called. The whole `Manager` is misleading scaffolding.
- **Evidence**:
  ```ruby
  module Plugins
    module Manager
      @queue = Queue.new
      def start; Thread.new { run }; end   # private instance method
      ...
    end
  end
  # app/service/plugins/service.rb:7-11
  def install(_plugin_name)
    Manager.run do         # ← NoMethodError (private) + wrong block semantics
      install_plugin      # ← NameError (undefined)
    end
  end
  ```
- **Recommendation**: Either delete `Plugins::Manager` and `Plugins::Service#install` (they are unused), or finish the implementation: add `module_function` (or `extend self`), fix `install_plugin` to a real install step, and start the manager from `puma.rb` `on_worker_boot`. Given S-12 already references undefined `::SCHEDULER`/`::EXECUTOR`, the scheduler story is half-built.
- **Effort**: S

### S-10 — `Settings::Service` is empty; system settings have no CRUD API

- **Description**: `Settings::Service` (`app/service/settings/service.rb`) is an empty class. `SettingsExpo` (`app/expo/settings_expo.rb`) only declares `http_path "/settings"` and `use_service Settings::Service` — no `json_api` block, no `show`/`index`/`update`. The `Setting::Repository` (`app/model/setting.rb`) has working `get`/`set` queries and an `event(name: "updated")` decorator, but nothing wires them to HTTP. The `settings` table exists in the migration.
- **Impact**: System-level settings are effectively write-only from inside the process (via `Setting::Repository#set`) and invisible via HTTP. Either the feature is unfinished, or it is intentionally internal-only — but then the `/settings` HTTP path is dead surface area that invites confusion.
- **Evidence**:
  ```ruby
  # app/service/settings/service.rb
  module Settings
    class Service < Verse::Service::Base
    end
  end
  # app/expo/settings_expo.rb
  class SettingsExpo < BaseExpo
    http_path "/settings"
    use_service Settings::Service
  end
  ```
- **Recommendation**: Either implement the CRUD surface (with proper auth — system settings are org/admin-level, see auth-authorization guide) or remove `SettingsExpo` registration from `config/routes.rb` until it is ready. Document the intended scoping (system vs org vs user) explicitly.
- **Effort**: M

### S-11 — `PluginLifecycleContext` is a no-op stub

- **Description**: `PluginLifecycleContext` (`app/util/plugin_lifecycle_context.rb`) defines `mount_plugin(plugin_name)` and `unmount_plugin` as empty methods that do nothing. The shared `PluginSystem::Plugin#start` (`common/lib/plugin_system/plugin.rb:58-67`) instantiates this context and passes it to the plugin's `init`, and `Plugin#stop` calls `@context.unmount_plugin`. Because the methods are no-ops, plugins that call `context.mount_plugin(...)` (per the guide's examples) have their registrations silently dropped, and `unmount_plugin` does not clean up.
- **Impact**: Plugins cannot register processors/exporters/modalities through the context — the registration mechanism documented in `guide/plugin-system.md` is non-functional in the Setting service. This explains why `show_modalities` reads from `PluginSystem.registry.plugins` (which is populated by `Registry#register`) rather than via the context.
- **Evidence**:
  ```ruby
  class PluginLifecycleContext
    def mount_plugin(plugin_name); end   # no-op
    def unmount_plugin; end              # no-op
  end
  ```
- **Recommendation**: Implement the context methods to delegate to the appropriate service-specific registries (see `guide/plugin-system.md` and the media/sync `PluginLifecycleContext` for reference), or document that the Setting service intentionally does not host plugin backends.
- **Effort**: M

### S-12 — `on_worker_boot` references undefined `::SCHEDULER` and `::EXECUTOR`

- **Description**: `config/puma.rb:16-19`:
  ```ruby
  on_worker_boot do
    ::SCHEDULER.start
    ::EXECUTOR.start
  end
  ```
  Neither `SCHEDULER` nor `EXECUTOR` is defined anywhere in the Setting service (no `Gemfile` scheduler gem, no initializer). This appears to be copy-pasted from the Media service (which has a job system). With `PUMA_WORKERS > 1`, every worker boot will raise `NameError: uninitialized constant SCHEDULER`.
- **Impact**: The Setting service cannot run with more than one puma worker. In single-worker mode the `on_worker_boot` block is not invoked, so this is latent.
- **Evidence**: `config/puma.rb:16-19`; grep for `SCHEDULER`/`EXECUTOR` in `app/setting/` returns no definitions.
- **Recommendation**: Remove the `on_worker_boot` block (or guard it with `defined?(::SCHEDULER)`). If a scheduler is genuinely planned, add the gem and initializer first.
- **Effort**: S

### S-13 — `items_per_page: 1000` default — unbounded-feeling pagination

- **Description**: `AccountSettings::Service#index` (`app/service/account_settings/service.rb:7`) defaults `items_per_page: 1000`. There is no upper-bound validation visible; a caller can pass `items_per_page: 100000`. The `account_settings` table grows with `(accounts × setting_keys × plugins)`.
- **Impact**: A caller with `index` permission can request very large pages, increasing DB load and response size. Not catastrophic given the table is small, but the default itself is high.
- **Evidence**: `def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)`
- **Recommendation**: Clamp `items_per_page` to a max (e.g. 100) inside the service. Lower the default.
- **Effort**: S

### S-14 — `serve_file` has duplicate nil-checks and no `File.exist?` before `File.read`

- **Description**: `Plugins::Service#serve_file` (`app/service/plugins/service.rb:135-141`):
  ```ruby
  return nil if file_path.nil?
  return unless file_path           # ← redundant, same condition
  File.read(File.join(plugin.path, file_path))
  ```
  The two returns are equivalent. There is no `File.exist?` check before `File.read`, so if the manifest points at a non-existent file, `File.read` raises `Errno::ENOENT` which propagates unhandled to the expo (which returns `nil` only if the service returns nil — an exception bypasses that).
- **Impact**: A misconfigured manifest yields a 500 instead of a 404. Minor, but degrades the "return 404 if not found" contract documented in the spec.
- **Evidence**: see snippet above.
- **Recommendation**: Remove the redundant `return unless file_path`. Add `return nil unless File.exist?(full_path)` before `File.read`.
- **Effort**: S

### S-15 — `find` does `Dir.glob` on every call; globs a config-derived path that may contain `;`-separated globs

- **Description**: `Plugins::Service#find` (`app/service/plugins/service.rb:13-30`) reads `Verse.config.extra_fields.dig(:idah, :plugins, :path)` (default `"plugins/**"`), splits on `";"`, and calls `Dir.glob` on each segment on *every* `find` call. There is no caching. The same logic is duplicated in `Plugin::Record#path` (`app/model/plugin.rb:40-56`).
- **Impact**: Every `serve_file`/`serve_asset` request triggers filesystem globs — a performance hit under load and a TOCTOU surface. The duplication means the two implementations can drift.
- **Evidence**:
  ```ruby
  plugin_path.split(";").each do |path|
    Dir.glob(path).each do |dir|
      name = dir.split("/").last
      next unless name == plugin_name
      return Plugin::Record.from_path(dir)
    end
  end
  ```
- **Recommendation**: Cache the plugin catalogue in memory (refreshed on plugin restart events). Extract the glob-and-match logic into a single method shared by `find` and `Plugin::Record#path`.
- **Effort**: M

### S-16 — `set` uses `Sequel.lit("?::jsonb", value.to_json)` — raw SQL fragment

- **Description**: `AccountSetting::Repository#set` (`app/model/account_setting.rb:50`) and `Setting::Repository#set` (`app/model/setting.rb:32`) both do:
  ```ruby
  value = Sequel.lit("?::jsonb", value.to_json)
  ```
  then use that `value` in `insert_conflict(...).insert({ ..., value:, ... })`. `Sequel.lit` marks a string as literal SQL; the `?` placeholder is parameterised, so this is not injectable *here*, but the pattern is fragile — any future refactor that interpolates into the `Sequel.lit` string would become injectable.
- **Impact**: Low immediate risk; high maintenance fragility.
- **Evidence**: `value = Sequel.lit("?::jsonb", value.to_json)`
- **Recommendation**: Prefer the `Verse::Sequel::JsonEncoder` already declared via `encoder :value, Verse::Sequel::JsonEncoder` and let Sequel handle the cast, or use `Sequel.cast(value.to_json, :jsonb)`. Add a comment explaining why the explicit cast is needed.
- **Effort**: S

### S-17 — Anonymous renderer class defined inline with `Class.new`

- **Description**: `PluginsExpo#serve` (`app/expo/plugins_expo.rb:86-97`) defines the response renderer as an anonymous `Class.new` that reads `server.request.env["verse.http.server"].params["filename"]` to set `Content-Type`. The class is untestable in isolation, captures request state stringly, and is re-instantiated per request.
- **Impact**: Maintainability and testability cost; the `puts last_response.body` in the spec (`plugins_expo_spec.rb:18,57`) suggests manual debugging was needed.
- **Evidence**:
  ```ruby
  renderer: Class.new do
    def render(result, server)
      case File.extname(server.request.env["verse.http.server"].params["filename"])
      when ".js" then server.response["content-type"] = "text/javascript"
      when ".css" then server.response["content-type"] = "text/css"
      end
      result
    end
  end
  ```
- **Recommendation**: Extract to a named class (e.g. `Plugins::FileRenderer`) under `app/util/` or `app/expo/`, with a unit test. Use the `params` already extracted by the `input` block rather than re-reading `request.env`.
- **Effort**: S

### S-18 — Typo `curent_plugin_name` (should be `current_plugin_name`)

- **Description**: `Plugin::Record#path` (`app/model/plugin.rb:50`) spells the local variable `curent_plugin_name` (missing an `r`).
- **Impact**: Cosmetic; no functional effect.
- **Evidence**: `curent_plugin_name = "#{name}-#{version}"`
- **Recommendation**: Rename to `current_plugin_name`.
- **Effort**: S

### S-19 — Redundant `return unless file_path` after `return nil if file_path.nil?`

- **Description**: See S-14; the second `return unless file_path` (`app/service/plugins/service.rb:137`) is dead because `return nil if file_path.nil?` already handles the nil case on the preceding line.
- **Impact**: Dead code; mild confusion.
- **Evidence**: `app/service/plugins/service.rb:135-137`.
- **Recommendation**: Delete the redundant line.
- **Effort**: S

### S-20 — Event handlers use raw strings instead of `Resource::Iam::Accounts` constant

- **Description**: `AccountSettingsExpo` subscribes with `expose on_resource_event("iam:accounts", "created")` and `("iam:accounts", "deleted")` (`app/expo/account_settings_expo.rb:23, 28`). AGENTS.md golden rule #4 mandates `Resource::Service::Entity` constants for resource event channels. The canonical constant is `Resource::Iam::Accounts`.
- **Impact**: String drift risk; the spec also hardcodes `"iam:accounts"` (`account_settings_expo_spec.rb:88,104`).
- **Evidence**: `expose on_resource_event("iam:accounts", "created")`
- **Recommendation**: Use `Resource::Iam::Accounts` in both the expo and the spec.
- **Effort**: S

### S-21 — `install` calls `Manager.run { install_plugin }` but `install_plugin` is undefined

- **Description**: `Plugins::Service#install` (`app/service/plugins/service.rb:7-11`):
  ```ruby
  def install(_plugin_name)
    Manager.run do
      install_plugin
    end
  end
  ```
  `install_plugin` is not defined anywhere in `Plugins::Service` or its ancestors. `Manager.run` itself is broken (S-09). The parameter is named `_plugin_name` (underscore-prefixed = intentionally unused).
- **Impact**: `install` is dead code that will raise `NameError` if invoked.
- **Evidence**: see snippet.
- **Recommendation**: Remove `install` until the install flow is implemented, or implement it against the (currently stub) `PluginSystem::Registry#retrieve_plugin` which itself raises `TODO`.
- **Effort**: S

### S-22 — Stale French/English comments describing routes that don't match implemented paths

- **Description**: `PluginsExpo` (`app/expo/plugins_expo.rb:6-9`) has a comment block:
  ```
  # GET plugins/modalities # return all modalities available
  # GET plugins/:plugin_name/files/plugin.js|css # Entrypoint pour le plugin
  # GET plugins/:plugin_name/files/entry.js|css # Entrypoint for show les entries
  # GET plugins/:plugin_name/assets/... # public static files
  ```
  The implemented `serve` endpoint accepts `:filename` (not `plugin.js|css` literally) and there is no `entry.js`/`entry.css` route — the manifest uses `details.js`/`details.css`. The comments mix French and English.
- **Impact**: Misleading documentation for future maintainers.
- **Evidence**: `plugins_expo.rb:6-9`.
- **Recommendation**: Update or remove the comment block; keep documentation in English per the rest of the codebase.
- **Effort**: S

### S-23 — Commented-out `plugin_images` table — dead schema intent

- **Description**: The migration (`db/migrations/20250928000000_create_initial_schema.rb:49-60`) contains a fully commented-out `create_table(:plugin_images)` block.
- **Impact**: Dead code in a migration; clutters the file.
- **Evidence**: see migration lines 49-60.
- **Recommendation**: Remove the commented block or move the intent to a TODO/issue tracker.
- **Effort**: S

### S-24 — Specs `puts last_response.body` left in tests

- **Description**: `app/expo/plugins_expo_spec.rb:18` and `:57` both call `puts last_response.body` inside `it` blocks, printing response bodies to the spec output.
- **Impact**: Noisy test runs; suggests leftover debugging.
- **Evidence**: `puts last_response.body` (lines 18, 57).
- **Recommendation**: Remove the `puts` calls.
- **Effort**: S

### S-25 — `rmagick` dependency present but unused in this service

- **Description**: `Gemfile:29` declares `gem "rmagick", "~> 6.0.1"`, and the Dockerfile installs `ffmpeg`/`imagemagick`/`libmagickwand-dev`. No `.rb` file in `app/setting/` requires or references `rmagick` or `Magick`. The `verse-shrine` gem is also included but the only `shrine` config is in `config.test.yml`/`config.development.yml` (not `config.yml`), so it's test/dev-only.
- **Impact**: Larger image, larger attack surface (ImageMagick has had many CVEs), slower builds — for a service that doesn't use image processing. This looks copy-pasted from the Media service.
- **Evidence**: `Gemfile:29`; grep `rmagick\|Magick` in `app/setting/` returns no usage.
- **Recommendation**: Drop `rmagick` from the Setting service Gemfile and remove `ffmpeg`/`imagemagick`/`libmagickwand-dev` from its Dockerfile unless a future feature needs them.
- **Effort**: S

---

## Cross-cutting observations

- **Both services** use the same `set_keys.rb` and `load_roles.rb` initializers and the same `BaseExpo` pattern; findings there are covered in `audit/01-common-library.md` (e.g. `RoleBackend` auth-context bypass).
- **Both services** call `bundle exec rake db:setup db:migrate` in `dev-entrypoint.sh` on every container start, which is fine for dev but risky if the entrypoint is reused in production (running `db:setup` against a populated DB).
- **Notification → Setting coupling**: the Notification service's per-email `Api[:idah].setting.account_settings.index` call (N-05) is the only runtime consumer of `AccountSettings::Service#index` from outside the Setting service, which makes S-04/S-05's auth bugs reachable from the Notification path indirectly (a suppressed notification is the intended outcome, but the index call itself is unauthenticated service-to-service).