# IDAH Codebase Audit — Master Summary

> Audit performed 2026-06-18. Reports live in sibling files `01-…` through `09-…`.
> This file is the dispatch index: it surfaces the highest-impact findings across the whole stack so fixes can be planned and assigned. Detailed evidence and recommendations are in each per-area report.

## Scope

| # | Area | Report | Findings |
|---|------|--------|----------|
| 01 | Shared `common/` library (api, auth, plugins, thread pool, uuid) | [`01-common-library.md`](01-common-library.md) | 30 |
| 02 | IAM service (auth, accounts, sessions, API keys, orgs) | [`02-iam-service.md`](02-iam-service.md) | 34 |
| 03 | Dataset service (projects, datasets, entries, annotations, workflows) | [`03-dataset-service.md`](03-dataset-service.md) | 26 |
| 04 | Media service (uploads, jobs, ffmpeg, processors) | [`04-media-service.md`](04-media-service.md) | 23 |
| 05 | Sync service (exports, jobs, UPD generation) | [`05-sync-service.md`](05-sync-service.md) | 25 |
| 06 | Audit service (event log) | [`06-audit-service.md`](06-audit-service.md) | 15 |
| 07 | Notification + Setting services (email, plugins, settings) | [`07-notification-setting-services.md`](07-notification-setting-services.md) | 40 |
| 08 | Frontend (SvelteKit + TS) | [`08-frontend.md`](08-frontend.md) | 23 |
| 09 | Infra / CI / Dockerfiles / boot config | [`09-infra-config.md`](09-infra-config.md) | 13 |
| | **Total** | | **229** |

## Top-priority themes (cross-cutting)

These patterns recur across services and should be addressed as horizontal initiatives rather than one-off fixes:

1. **Inter-service HTTPS is fundamentally unsafe** (`common/lib/api/exposition.rb`).
   TLS verification is disabled (`VERIFY_NONE`), JWT signatures are not verified before claims are trusted, and there are no timeouts. **Every cross-service call inherits these weaknesses.** Fix once in `common/`, every service benefits. → F-001, F-002, F-003, F-008.

2. **Auth scoping is bypassed in many places.** The golden rule "every repository must implement `scoped(action)`" is violated in the highest-risk services: audit logs (`AUD-001`), account settings (`S-04`), and several job/export paths run under `Verse::Auth::Context[:system]` with no per-org/per-project filter. This is the single biggest IDOR/privilege-escalation surface. → AUD-001, S-04, S-05, SYNC-007, F02, F18, D12.

3. **Command injection / arbitrary class loading in job pipelines.** Both the sync UPD exporter (`SYNC-001`) and the media processor job (`M-02`) construct shell commands or `constantize` DB-stored strings without `Shellwords.escape` or an allowlist. The fix in `app/util/executor.rb` already exists but is unused. → SYNC-001, SYNC-020, M-02, M-03.

4. **Unbounded pagination everywhere.** The default `items_per_page: 1000` is copy-pasted across nearly every service's `index` methods, with no server-side cap and no max enforcement. Combined with eager JSON columns and `index_all(...).map` in exports, this is a denial-of-service and OOM vector. → D08, M-18, SYNC-005/006/010, AUD-006, F29, S-13.

5. **Cross-service HTTP calls inside repository `scoped` methods.** Several repositories call `Api[:idah].dataset.projects.index_all` (or similar) inside `scoped` to compute the visible project set — meaning every list/show triggers a synchronous inter-service round-trip. This compounds finding #1 (no timeouts) and #4 (unbounded). → F13, F14, M-13, SYNC-017, D21.

6. **Plugin system is an RCE surface.** Plugin manifests are loaded from disk with no signature/allowlist (`S-07`), the setting service serves plugin files via anonymous endpoints with incomplete path-traversal guards (`S-01`, `S-02`, `S-03`, `S-06`), and the frontend injects plugin URLs into `<script src>` (`FE-015`). Treat as one combined initiative.

7. **Email pipeline has classic injection + XSS issues.** No CRLF validation on recipients/subjects (`N-01`), unescaped HTML templates (`N-02`), blocking SMTP on the event thread with no timeout (`N-04`).

8. **Dead/broken code shipped to production.** Several features are partially implemented and will fail at runtime: `Video::Job` does not exist (`M-01`), `Plugins::Manager` and `Plugins::Service#install` raise `NameError` (`S-09`, `S-21`), `Settings::Service` is empty (`S-10`), `cd-docs.yml` references `actions/checkout@v6` which does not exist (`INFRA-P07`), and `ci.yml` uploads the wrong coverage directory for 3 services (`INFRA-P01`).

---

## Critical findings (fix first)

| ID | Area | Title |
|----|------|-------|
| F-001 | common | TLS certificate verification disabled for HTTPS |
| F-002 | common | JWT signature not verified before parsing claims |
| F01 | IAM | Password-reset token returned in HTTP response after invitation join |
| F02 | IAM | Login flow depends on auth-scoped repository, breaking unauthenticated lookup |
| F03 | IAM | Account enumeration via create-or-return-existing behavior |
| M-01 | media | `Video::Job` class referenced but never defined — video processing is broken |
| M-02 | media | Arbitrary class instantiation via `constantize` on DB-stored job arguments |
| SYNC-001 | sync | Command injection via unsanitized user data in `system()` calls |
| SYNC-002 | sync | Predictable `/tmp` export path (symlink/TOCTOU) |
| AUD-001 | audit | `Log::Repository` has no `scoped(action)` override — no per-org isolation |
| AUD-002 | audit | No role grants any right on `audit:logs` — feature is dead |
| FE-008 | frontend | XSS: `{@html}` renders `marked` output without sanitization |
| FE-015 | frontend | Plugin loader injects user-controlled `pluginId` into `<script src>` |

## High findings (fix next)

| ID | Area | Title |
|----|------|-------|
| F-003 | common | No HTTP open/read/write timeouts on inter-service client |
| F-004 | common | Cached token state mutated without synchronization |
| F-005 | common | `RoleBackend` bypasses auth context scoping |
| F-006 | common | `PluginSystem.restart_plugin` is undefined → runtime `NoMethodError` |
| F-007 | common | `ThreadPool#stop` not idempotent; tasks can be silently dropped |
| F-008 | common | Error responses not surfaced — body discarded, status only |
| F04 | IAM | Shared memoized repository across requests — thread-safety leak |
| F05 | IAM | Asymmetric timing-attack mitigation in `login` |
| F06 | IAM | Role/role_scope update lacks target-role authorization (privilege escalation) |
| F07 | IAM | Cookies missing `same_site` attribute (CSRF risk) |
| F08 | IAM | API-key login returns distinguishable error messages |
| F09 | IAM | Password-reset token not single-use — concurrent reset race |
| D01 | dataset | Self-review bypass: annotator can review own submission |
| D02 | dataset | Missing project/dataset consistency check on annotation create |
| D03 | dataset | Note feed `annotation_id` not validated against entry's dataset (IDOR) |
| D04 | dataset | `mark_entries_status_as` silently no-ops on stale status |
| M-03 | media | `Open3.popen3` invoked with shell string — command injection risk |
| M-04 | media | No timeout on subprocess execution (ffmpeg can hang forever) |
| M-05 | media | File upload loads entire file into memory; no size limit, no streaming |
| M-06 | media | Download endpoint trusts DB-stored `mime_type` — stored XSS / spoofing |
| SYNC-003 | sync | `Content-Disposition` filename not escaped (header injection) |
| SYNC-004 | sync | `scoped` for `as_org_owner` returns empty set when no custom scope set |
| SYNC-005 | sync | Unbounded `index_all(...).map` loads entire dataset graph into memory |
| SYNC-006 | sync | Media binaries downloaded into memory |
| SYNC-007 | sync | Job instantiates `Exports::Service` with system context, bypassing scoping |
| SYNC-008 | sync | `process` invoked while holding scheduler monitor (deadlock risk) |
| SYNC-009 | sync | No stale-`running`-job recovery |
| AUD-003 | audit | Actor email and role name persisted in plaintext and indexed (PII) |
| AUD-004 | audit | Failed-login events record victim email/role |
| AUD-005 | audit | Event subscribers never validate event source / payload shape |
| N-01 | notification | No validation of `to_email` / `notification.title` (CRLF / header injection) |
| N-02 | notification | Unescaped user-controlled data in HTML email templates (stored XSS) |
| N-03 | notification | Account enumeration via distinguishable "not found" error |
| N-04 | notification | Blocking SMTP `Mail.deliver` on event dispatcher with no timeout |
| S-01 | setting | `serve_asset` path-traversal guard is incomplete |
| S-02 | setting | `serve_file` has no path-traversal guard |
| S-03 | setting | `modalities` and `show_modality` endpoints are `auth: nil` (anonymous) |
| S-04 | setting | `own?` scope returns unfiltered table for `:create` |
| S-05 | setting | `Service#create`/`delete` bypass auth context |
| S-06 | setting | `serve_asset` reads file with no MIME/size cap; anonymous callers |
| FE-007 | frontend | Open redirect via unvalidated `redirectTo` query parameter |
| INFRA-P01 | infra | Wrong coverage path uploaded for notification/setting/audit CI jobs |

## Medium findings (plan into backlog)

Roughly 60 Medium findings across all reports. The recurring shapes are:

- **Performance / DoS**: unbounded `items_per_page: 1000` defaults (D08, M-18, SYNC-010, AUD-006, F29, S-13); cross-service HTTP inside `scoped` (F13, F14, M-13, SYNC-017, D21); in-memory slurping of files/exports (M-05, M-12, SYNC-005, SYNC-006).
- **Authz gaps**: role escalation in `project_member.update` (D05); entry re-assignment race (D06); `use_system_repo` misuse (F17, F18, D12, M-07, SYNC-024); plugin endpoints anonymous (S-03).
- **Code smells with security flavor**: `Sequel.lit` raw fragments (F30, AUD-007, S-16); hardcoded role/status strings instead of `Resource::*` constants (F21, F22, AUD-012, S-20); `SecureRandom.hex` instead of `UUIDv7.generate` (F20).
- **Reliability**: no DLQ/retry on event subscribers (AUD-009); swallowed plugin/stat errors (D11); scheduler holding monitor while dispatching (SYNC-008); no stale-job recovery (SYNC-009); `puma.rb` doesn't reconnect Sequel in worker fork (INFRA-P04).
- **Frontend**: cache not scoped to auth context (FE-023); `<Can>`/`PageProvider` `roles` override (FE-021); N+1 in `AuthContext.can()` (FE-004); `{@html icon}` for plugin markup (FE-09).

See individual reports for the full Medium lists.

## Low / Info findings

~95 findings. Most are quick wins (typos like `passowrd`/`pciture_url`/`curent_plugin_name`, debug `puts`/`console.log` left in code, dead code, missing indexes, stale TODOs). They are catalogued per-report and can be batch-fixed opportunistically.

---

## Suggested fix waves

### Wave 1 — Security fundamentals (1–2 sprints)
- Fix `common/lib/api/exposition.rb`: enable TLS verification, verify JWT signatures, add timeouts, surface error bodies. (F-001/002/003/008)
- Fix sync command injection: switch `Exports::Upd::Exporter` to the existing `Executor` with `Shellwords.escape`. (SYNC-001, SYNC-020)
- Fix media `constantize` allowlist: mirror the `Jobs::Scheduler` pattern in `Processor::Job`. (M-02)
- Fix IAM password-reset token leak and single-use enforcement. (F01, F09)
- Fix audit log authz: implement `scoped(action)` and grant scoped rights to a real role. (AUD-001, AUD-002)
- Fix setting service plugin endpoints: require auth, complete path-traversal guards, MIME/size caps. (S-01/02/03/06)
- Fix frontend XSS: sanitize `marked` output; validate `pluginId` against an allowlist before injecting into `<script src>`. (FE-008, FE-015)

### Wave 2 — Authz hardening (1 sprint)
- Audit every `use_system_repo` call site and justify or remove. (F17, F18, D12, M-07, SYNC-007, SYNC-024)
- Add `scoped(action)` overrides wherever missing.
- Fix role-escalation paths (F06, D05) and IDORs (D02, D03, S-04, S-05).
- Add CSRF `SameSite` to cookies (F07) and rate limiting on auth endpoints.

### Wave 3 — Reliability & performance (1–2 sprints)
- Cap `items_per_page` server-side; add max-page-size enforcement in the framework hook. (D08, M-18, SYNC-010, AUD-006, F29, S-13)
- Move cross-service `scoped` lookups behind a cache or push them into the auth token's custom claims. (F13, F14, M-13, SYNC-017, D21)
- Stream file uploads/downloads; add size limits and timeouts. (M-04, M-05, M-12, SYNC-005, SYNC-006, N-04)
- Add stale-job recovery and DLQ for events. (SYNC-009, AUD-009)
- Reconnect Sequel in puma `on_worker_boot`. (INFRA-P04)

### Wave 4 — Email + plugin system redesign (1 sprint)
- Centralize email rendering with auto-escaping; validate headers; pool SMTP. (N-01/02/04/12)
- Sign plugin manifests or enforce an on-disk allowlist; audit `Plugin#start` lifecycle. (S-07, F-006, F-017, F-018)

### Wave 5 — CI/CD & deployment hygiene (0.5 sprint)
- Fix coverage upload paths and `actions/checkout@v6`. (INFRA-P01, INFRA-P07)
- Move `pry` to dev group; remove unconditional `require "pry"`. (INFRA-P02, F-013)
- Add non-root `USER` to Dockerfiles; multi-stage builds. (INFRA-P03, INFRA-P08)
- Validate required env vars at boot; default `LOG_SHOW_ERROR_DETAILS` to false. (INFRA-P05, F24)

### Wave 6 — Dead code & polish (ongoing)
- Remove or finish: `Video::Job` (M-01), `Plugins::Manager` (S-09), `Settings::Service` (S-10), `PluginLifecycleContext` (S-11), `Api::Service#path` (F-026), global `EXECUTOR` (M-08).
- Fix typos and remove debug `puts`/`console.log` (FE-013, FE-018, FE-019, S-18, M-11, M-19, SYNC-023, S-24).

---

## Notes on confidence

- **Cross-service API findings** (F-001 to F-008) are the highest-confidence items in the whole audit — the issues are in one file (`common/lib/api/exposition.rb`) and visible directly.
- **Authz findings** depend on Verse framework behavior that was inferred from source where available and from naming conventions otherwise. Before scheduling fixes, verify each `scoped(action)` claim against the actual Verse version pinned in the Gemfiles (note F-029: verse gems are pinned to `master`/feature branches, so behavior may shift).
- **Performance findings** about N+1 and unbounded pagination are pattern-based; measure with real data before committing to large refactors.
- The audit is **static analysis only** — no code was executed, no exploits were attempted. Findings marked Critical/High are based on code paths that look exploitable; they should be confirmed by a dynamic pass before public disclosure.
