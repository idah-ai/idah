# IDAH Audit — Work Assignments

**Load:** roger 39 · brian 40 · audi 43 · tojo 40 · marc 38 · first 25

## ⛔ Ignored

**[common](01-common-library.md)**
* F-001 - TLS certificate verification disabled for HTTPS

---

## 🟣 Roger — `common/` + infra  *(39)*

**[common](01-common-library.md)**
* F-004 - Cached token state mutated without synchronization  ⭐ shared: inherited by all services
* F-005 - `RoleBackend` bypasses auth context scoping  ⭐ shared: inherited by all services
* F-006 - `PluginSystem.restart_plugin` is undefined  ⭐ shared: inherited by all services
* F-007 - `ThreadPool#stop` not idempotent; tasks can be dropped  ⭐ shared: inherited by all services
* F-009 - `YAML.safe_load` without explicit permitted classes
* F-010 - UUIDv7 has no monotonic counter; sub-ms collision possible
* F-011 - `Api.all` mutates and re-allocates the page hash each iteration  ⭐ shared: pagination cap
* F-012 - Duplicate `entries.index_all` registration
* F-013 - `require "pry"` shipped in production code
* F-014 - `lazy.select{}.each` swallows exception detail in healthcheck
* F-015 - `rescue RuntimeError` references possibly-uninitialized `status`
* F-016 - `PluginSystem` module-level mutable state without synchronization
* F-017 - `retrieve_plugin(name, version)` references undefined `version`
* F-018 - `Plugin#reload` calls `start` without required `context_class`
* F-019 - Compound-role dedup logic reverses semantics ambiguously
* F-020 - `SecureRandom` referenced but not required
* F-021 - `compound_role` overwrites `rights` variable; dead assignment
* F-022 - `build_uri` accepts unused `_headers` parameter
* F-023 - `SemanticVersion` does not support pre-release / build metadata
* F-024 - Regex-based `updated_at` detection in trigger is brittle
* F-025 - N+1 update loop in duplicate field helper
* F-026 - `Api::Service#path` defined but never called
* F-027 - `Dir.glob` eager-require bypasses Zeitwerk
* F-028 - `execute_request` is long and mixes concerns
* F-029 - All Verse gems pinned to `master` / feature branches
* F-030 - RuboCop excludes `common/**/*` from enforcement

**[infra](09-infra-config.md)**
* INFRA-P01 - Wrong coverage path uploaded for notification/setting/audit jobs
* INFRA-P02 - `require "pry"` shipped unconditionally in production
* INFRA-P03 - Containers run as root; no `USER`, no `read_only`
* INFRA-P04 - `on_worker_boot` restarts event manager but not Sequel DB connection
* INFRA-P05 - No boot-time validation of required env vars
* INFRA-P06 - SSH private key materialized on runner; `gcloud` CLI unpinned
* INFRA-P07 - `actions/checkout@v6` does not exist
* INFRA-P08 - `wget`/`git`/`curl` installed in production runtime image
* INFRA-D01 - Dev Postgres uses `postgres:postgres` on host port 5432
* INFRA-D02 - Dev Redis has no auth on host port 6379
* INFRA-D03 - Dev nginx missing CSP / `Referrer-Policy` / `Permissions-Policy`
* INFRA-D04 - No rate limiting on auth/upload endpoints (dev only)
* INFRA-D05 - Dev defaults documented as insecure (admin/P@ssword01, committed JWT keys)

---

## 🔵 Brian — IAM + media security criticals  *(40)*

**[IAM](02-iam-service.md)**
* F01 - Password-reset token returned in HTTP response after invitation join
* F02 - Login flow depends on auth-scoped repository
* F03 - Account enumeration via create-or-return-existing
* F04 - Shared memoized repository in `RefreshToken` module
* F05 - Asymmetric timing-attack mitigation in `login`
* F06 - Role/role_scope update lacks target-role authorization
* F07 - Cookies missing `same_site` attribute
* F08 - API-key login returns distinguishable error messages
* F09 - Password-reset token not single-use / no rotation on read
* F10 - API key label leaks first 10 characters of raw key
* F11 - `check_seq` UPDATE has no row lock and shape is index-unfriendly
* F12 - `join` endpoint is unauthenticated and trusts URL `:token`
* F13 - N+1 cross-service call inside `Account::Repository` scope builder
* F14 - Cross-service `Api[:idah]` call on every API-key list/show
* F15 - `remove_org_from_account_role_scope` is N+1
* F16 - Duplicated password-policy rule block
* F17 - `use_system_repo` for accounts in `Account::Service`
* F18 - Heavy `use_system_repo` in `Auth::Service`
* F19 - Broken boolean expression `("system" || "admin")`
* F20 - `SecureRandom.hex` used for tokens
* F21 - Hardcoded role/status strings
* F22 - Hardcoded `"iam:api_keys"` resource string
* F23 - Service starts even when JWT key is public-only
* F24 - `show_error_details` defaults to true
* F25 - Hardcoded dev admin password
* F26 - `password_reset_token` column not unique / not indexed
* F27 - Swallowed exception in `Auth::SimpleExpo#refresh`
* F28 - `join` route/input parameter mismatch
* F29 - Default `items_per_page: 1000` for account index
* F30 - `Sequel.lit` with JSON parameterization
* F31 - `AccountSessionsExpo` relies on repo-level scoping only
* F32 - `OrganizationsExpo` registered twice
* F33 - Stale TODO in `Account::Repository`
* F34 - Mixed `use_repo` / `use_system_repo` / `use` / `use_service` DSL

**[media (security criticals)](04-media-service.md)**
* M-01 - `Video::Job` class referenced but never defined
* M-02 - Arbitrary class instantiation via `constantize` on DB job arguments
* M-03 - `Open3.popen3` with shell string — command injection risk  ⛓ part of `Executor` consolidation (roger); coordinate
* M-04 - No timeout on subprocess execution  ⛓ part of `Executor` consolidation (roger); coordinate
* M-05 - File upload loads entire file into memory; no size limit
* M-06 - Download endpoint trusts DB-stored `mime_type` / `size`

---

## 🟢 Audi — Dataset + media (remainder)  *(43)*

**[dataset](03-dataset-service.md)**
* D01 - Self-review bypass via `reviewed_by_id` reuse
* D02 - Missing project/dataset consistency check on annotation create
* D03 - Note feed `annotation_id` not validated against entry's dataset
* D04 - `mark_entries_status_as` uses stale status filter
* D05 - Role escalation via `update` when role unchanged
* D06 - `select` allows re-assigning an already-assigned entry
* D07 - Annotator `resolve` scope is too broad for own-created feeds
* D08 - Default `items_per_page: 1000` with eager JSON columns
* D09 - Missing indexes on hot annotation/note_feed filter columns
* D10 - `EntryStat::Repository.new(nil)`
* D11 - Plugin stat errors swallowed
* D12 - `ScopedQuery::Service` is a misnamed module
* D13 - `assign_member` does not verify target member belongs to entry's project
* D14 - Undefined local `project_id` in `ProjectMember::Repository#scoped`
* D15 - `update_progress!` re-fetches dataset row per submit
* D16 - `assigned` filter coerces arbitrary truthy strings
* D17 - `entry_workflow` hardcoded; `workflow_configuration.type` ignored
* D18 - `sample_rate` default makes sampling deterministic-true
* D19 - JSON-RPC `RpcCreateSchema` allows unbounded open Hashes
* D20 - `notify_dataset_completed` sends emails synchronously in service
* D21 - IAM HTTP call inside `after_commit`
* D22 - `wf_step`/`status` not readonly on `Entry::Record`
* D23 - Dead/commented `created_by_email` on Dataset
* D24 - Org-owner `update`/`delete` scope on note feeds/comments is creator-only
* D25 - Annotation triggers cause write amplification
* D26 - Spec uses wrong RPC path

**[media (jobs/processor/misc)](04-media-service.md)**
* M-07 - `use_system jobs:` bypasses auth scoping when creating processor jobs
* M-08 - Global `EXECUTOR` is started/stopped but never used  ⛓ resolved as part of `Executor` consolidation (roger)
* M-09 - `use_system video_service:` declared but never called
* M-10 - Scheduler `process` rescues and re-raises after marking errored
* M-11 - `puts` debug statement in `Video::Service`
* M-12 - `download_original` reads entire file into memory
* M-13 - Auth scoping makes synchronous HTTP calls per request
* M-14 - `reschedule` called with mismatched signature
* M-15 - `next_scheduled_time` returns raw `[:min]`
* M-16 - `emit` may call nil `@command`
* M-17 - `Context#reschedule!` / `error!` call non-existent bang methods
* M-18 - Default `items_per_page: 1000`
* M-19 - `puts ENV["PUMA_WORKERS"]` on boot
* M-20 - JWT key accepts raw env content without origin validation
* M-21 - `JobsExpo` does not extend `BaseExpo`
* M-22 - Multiple processor jobs per entry; only last `job_id` stored
* M-23 - Unresolved TODO about background processors and audit events

---

## 🟠 Tojo — Sync + Audit  *(40)*

**[sync](05-sync-service.md)**
* SYNC-001 - Command injection in UPD exporter
* SYNC-002 - Predictable `/tmp` export path
* SYNC-003 - Unescaped `Content-Disposition` filename
* SYNC-004 - `Exports::Repository#scoped` denies org-owners by default
* SYNC-005 - Unbounded in-memory enumeration of dataset graph
* SYNC-006 - Media binaries loaded into memory
* SYNC-007 - Job bypasses auth scoping
* SYNC-008 - Pool work enqueued while holding the scheduler monitor
* SYNC-009 - No recovery for stale `running` jobs
* SYNC-010 - Default page size 1000
* SYNC-011 - `system(..., exception: true)` swallows stderr and has no timeout
* SYNC-012 - File handle leaks in `IoContext`
* SYNC-013 - Unvalidated `IDAH_URL`
* SYNC-014 - Fragile export lookup in job
* SYNC-015 - `constantize` of `job.job_class` only checks subclass
* SYNC-016 - Float exponent in retry backoff
* SYNC-017 - Cross-service call inside `scoped` on every query
* SYNC-018 - Destructive mutation of annotation dimensions
* SYNC-019 - `in` pattern used as a boolean expression
* SYNC-020 - `Executor` with safe escaping is unused
* SYNC-021 - `formats` endpoint discards scope result
* SYNC-022 - Reaching into `exports.table.db.after_rollback`
* SYNC-023 - Stray `puts` at boot
* SYNC-024 - `use_system jobs: Jobs::Service`
* SYNC-025 - Inconsistent primary key types

**[audit](06-audit-service.md)**
* AUD-001 - `Log::Repository` has no `scoped(action)` override  ⭐ writes the reference impl the shared table depends on
* AUD-002 - No role grants any right on `audit:logs`
* AUD-003 - Actor email and role persisted in plaintext and indexed (PII)
* AUD-004 - Failed-login audit entries leak the victim account
* AUD-005 - Event subscribers run as system and do not validate source/payload
* AUD-006 - Default page size of 1000 with no service-side cap
* AUD-007 - Raw SQL fragment in custom `__nin` filter
* AUD-008 - Business logic in the exposition layer
* AUD-009 - No retry / DLQ / poison-message handling on subscribers
* AUD-010 - Repeated `each` blocks and rubocop disable
* AUD-011 - Local variable `service` shadows the `service` helper
* AUD-012 - Hardcoded resource string in repository
* AUD-013 - Index coverage is good (info, no action)
* AUD-014 - JWT key loading has minimal validation
* AUD-015 - Service layer is a thin pass-through

---

## 🟡 Marc — Setting + Frontend (core/criticals)  *(38)*

**[setting](07-notification-setting-services.md)**
* S-01 - `serve_asset` path-traversal guard is incomplete
* S-02 - `serve_file` has no path-traversal guard
* S-03 - `modalities` and `show_modality` endpoints are `auth: nil` (anonymous)
* S-04 - `own?` scope returns unfiltered table for `:create` — any user can create rows for any `account_id`
* S-05 - `Service#create`/`delete` bypass auth context — `account_id` from event payload used directly
* S-06 - `serve_asset` reads file with no MIME/size cap; returns raw `File` IO to anonymous callers
* S-07 - Plugin discovery trusts on-disk `manifest.json` (RCE via `Plugin#start` in common)
* S-08 - `plugins` table has no uniqueness constraint on `(name, version)`; `source_path` unchecked
* S-09 - `Plugins::Manager` is dead/broken: module methods on `self` won't work as written; never started
* S-10 - `Settings::Service` is empty; system settings have no CRUD API
* S-11 - `PluginLifecycleContext` is a no-op stub
* S-12 - `on_worker_boot` references undefined `::SCHEDULER` and `::EXECUTOR`
* S-13 - `items_per_page: 1000` default — unbounded-feeling pagination
* S-14 - `serve_file` has duplicate nil-checks and no `File.exist?` before `File.read`
* S-15 - `find` does `Dir.glob` on every call; globs a config-derived path that may contain `;`-separated globs
* S-16 - `set` uses `Sequel.lit("?::jsonb", value.to_json)` — raw SQL fragment
* S-17 - Anonymous renderer class defined inline with `Class.new`
* S-18 - Typo `curent_plugin_name` (should be `current_plugin_name`)
* S-19 - Redundant `return unless file_path` after `return nil if file_path.nil?`
* S-20 - Event handlers use raw strings instead of `Resource::Iam::Accounts` constant
* S-21 - `install` calls `Manager.run { install_plugin }` but `install_plugin` is undefined
* S-22 - Stale French/English comments describing routes that don't match implemented paths
* S-23 - Commented-out `plugin_images` table — dead schema intent
* S-24 - Specs `puts last_response.body` left in tests
* S-25 - `rmagick` dependency present but unused in this service

**[frontend (core/criticals)](08-frontend.md)**
* FE-001 - `runExpireCache()` setInterval never cleared (memory leak / global timer)
* FE-002 - `clearCache` uses `RegExp` built from user-controlled cacheKey (ReDoS / regex injection)
* FE-003 - `BackendDataSource` does not check `response.ok` for non-error JSON bodies
* FE-004 - `AuthContext.can()` performs a network call per check (N+1 / perf)
* FE-005 - `<Can>` component evaluates permissions only once on mount
* FE-006 - `AuthContext` stored in module-level state; no token visible but auth status is global mutable
* FE-008 - XSS: `{@html}` renders `marked` output without sanitization
* FE-010 - `filtersToHash` mutates a string as if it were an array (runtime crash)
* FE-011 - Bulk delete / unassign are sequential N+1 HTTP requests
* FE-012 - `parseSingleElementReturn` throws the string `"TODO: Handle error output"` on error responses
* FE-015 - Plugin loader injects user-controlled `pluginId` into `<script src>` and `<link href>`
* FE-016 - `Record` base class uses `[key: string]: any` index signature (defeats TypeScript safety)
* FE-021 - `PageProvider` and `<Can>` allow `roles` to silently override `can()` result

---

## ⚪ First — Notification + Frontend  *(25)*

Reviewed by **marc** (frontend) and **brian** (email security). Notification templates (N-02) share escaping concerns with the frontend XSS work — coordinate with marc.

**[notification](07-notification-setting-services.md)**
* N-01 - No validation of `to_email` / `notification.title` (CRLF / header injection)
* N-02 - Unescaped user-controlled data in HTML email templates (stored XSS)
* N-03 - Account enumeration via distinguishable "not found" error
* N-04 - Blocking SMTP `Mail.deliver` on event dispatcher with no timeout
* N-05 - Two sequential inter-service HTTP calls per email, no caching
* N-06 - Hardcoded sender string; no centralized email config
* N-07 - Dev SMTP has no auth/TLS
* N-08 - Spec hardcodes channel string instead of `Service::Notification::SEND_EMAIL_CHANNEL`
* N-09 - `fetch(notification.type, true)` defaults to sending (fail-open)
* N-10 - Template lookup swallows missing partials; raises generic `RuntimeError`
* N-11 - No error handling around `Mail.deliver`
* N-12 - New `Mail`/`Mail::Part` per send; no SMTP connection pooling
* N-13 - Typo "Your invited" in account_created template
* N-14 - No notification log table; no audit trail of sent emails
* N-15 - Template path not validated against `TEMPLATE_PATH` root

**[frontend (well-scoped)](08-frontend.md)**
* FE-007 - Open redirect via unvalidated `redirectTo` query parameter
* FE-009 - `{@html icon}` renders plugin-supplied markup without sanitization
* FE-013 - Verbose `console.log` / `console.debug` left in production code paths
* FE-014 - `delayed()` ignores the inner promise's resolution window
* FE-017 - `accept-invitation` page passes `token` from URL and surfaces `password_reset_token` in URL
* FE-018 - `audit-logs` page fetches `pciture_url` (typo) and uses mismatched switch key
* FE-019 - `AuthService.signInWithEmailAndPassword` interface has typo `passowrd`
* FE-020 - `Object.assign(project, projectRes.data)` mutates a Record instance, bypassing the JSON:API data layer
* FE-022 - `BackendDataSource.list({ all: true })` recurses without a safety bound
* FE-023 - `BackendDataSource` cache key ignores auth context (cross-user cache leak risk)

