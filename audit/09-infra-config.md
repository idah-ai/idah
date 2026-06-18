# 09 — Infrastructure, Deployment & Cross-Cutting Configuration Audit

> Scope note: The dev `docker-compose.yml`, `docker-compose-db.yml`, and `dev/nginx/nginx.conf` are explicitly dev-only (the project's own `SECURITY.md` documents that dev defaults — `postgres:postgres`, self-signed certs, committed JWT keys, `admin@idah.ai`/`P@ssword01` — must not be used in production). Those are listed briefly as **INFRA-D*** for awareness but are not treated as production findings. Production-affecting findings are **INFRA-P***.

## Executive Summary

The most material production concerns are in CI/CD and service boot configuration rather than in the dev compose topology. The `ci.yml` workflow uploads the wrong coverage directory for three services (notification, setting, audit all upload `${{ env.MEDIA_DIR }}/coverage`), silently masking coverage failures. The `cd-docs.yml` workflow writes an SSH private key to the runner's `~/.ssh/google_compute_engine` and runs `sudo docker compose` over `gcloud compute ssh`, which is acceptable but should pin the `gcloud` CLI version and use `gcloud compute scp`/OS Login rather than long-lived SSH keys. Every Ruby service's `boot.rb` does `require "pry"` unconditionally (not gated by environment), shipping the REPL in production images and enabling `binding.pry` to hang a worker if accidentally committed. Dockerfiles run as root with no `USER` directive and no `read_only` filesystem. `config.yml` references `IDAH_SERVICE_ACCOUNT`/`IDAH_SERVICE_PASSWORD` for inter-service credentials but there is no boot-time validation that required env vars are present — a missing var produces a cryptic `nil` error at first cross-service call rather than a clear startup failure. `puma.rb` uses `preload_app!` with `on_worker_boot { Verse.event_manager.restart }` but does not re-establish the Sequel DB connection in worker forks, which can lead to shared-connection corruption under multi-worker deployments.

## Findings Table

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| INFRA-P01 | High | Reliability | `.github/workflows/ci.yml:293,381,460` | Wrong coverage path uploaded for notification/setting/audit jobs |
| INFRA-P02 | Medium | Security | `app/*/config/boot.rb:5` (all services) | `require "pry"` shipped unconditionally in production |
| INFRA-P03 | Medium | Deployment | `app/*/Dockerfile` (all services) | Containers run as root; no `USER`, no `read_only` |
| INFRA-P04 | Medium | Reliability | `app/*/config/puma.rb:15-18` | `on_worker_boot` restarts event manager but not Sequel DB connection |
| INFRA-P05 | Medium | Config | `app/*/config/config.yml` | No boot-time validation of required env vars (`DATABASE_URI`, `REDIS_STREAM_URL`, `IDAH_SERVICE_*`) |
| INFRA-P06 | Medium | Security | `.github/workflows/cd-docs.yml:79-95` | SSH private key materialized on runner; `gcloud` CLI unpinned |
| INFRA-P07 | Low | Deployment | `.github/workflows/cd-docs.yml:25,72` | `actions/checkout@v6` does not exist (latest is v4) — workflow would fail if triggered |
| INFRA-P08 | Low | Deployment | `app/*/Dockerfile:6-18` | `wget`/`git`/`curl` installed in production runtime image |
| INFRA-D01 | Info | Security | `docker-compose-db.yml:9-14` | Dev Postgres uses `postgres:postgres` on host port 5432 |
| INFRA-D02 | Info | Security | `docker-compose-db.yml:17-25` | Dev Redis has no auth on host port 6379 |
| INFRA-D03 | Info | Security | `dev/nginx/nginx.conf:67-71` | Dev nginx missing CSP / `Referrer-Policy` / `Permissions-Policy` |
| INFRA-D04 | Info | Reliability | `dev/nginx/nginx.conf` | No rate limiting on auth/upload endpoints (dev only) |
| INFRA-D05 | Info | Config | `SECURITY.md:29-34` | Dev defaults documented as insecure (admin/P@ssword01, committed JWT keys) |

---

## INFRA-P01 — Wrong coverage path uploaded for notification/setting/audit jobs
- **Severity:** High
- **Category:** Reliability
- **File:** `.github/workflows/ci.yml:293, 381, 460`
- **Description:** The `notification`, `setting`, and `audit` jobs each upload `${{ env.MEDIA_DIR }}/coverage` instead of their own directory. `MEDIA_DIR` is `./app/media`, so these three jobs upload the media service's coverage artifact (or nothing, if media didn't run) under a misleading name. The "Check Code Coverage" step in the same jobs runs in the correct working directory, so the coverage *check* is valid, but the uploaded artifact is wrong.
- **Impact:** Coverage artifacts for notification/setting/audit are silently wrong/empty in CI. Anyone debugging coverage regressions for those services will be misled. The bug has likely gone unnoticed because the check step uses the local `coverage/` dir.
- **Evidence:**
  ```yaml
  # notification job (line 291-294)
  - name: Upload Code Coverage
    uses: actions/upload-artifact@v4
    with:
      name: notification-code-coverage
      path: ${{ env.MEDIA_DIR }}/coverage   # ← should be NOTIFICATION_DIR
  ```
  Same pattern at lines 380-381 (setting → `MEDIA_DIR`) and 459-460 (audit → `MEDIA_DIR`).
- **Recommendation:** Replace `env.MEDIA_DIR` with the correct `env.NOTIFICATION_DIR` / `env.SETTING_DIR` / `env.AUDIT_DIR` in each job's upload step.
- **Effort:** S

## INFRA-P02 — `require "pry"` shipped unconditionally in production
- **Severity:** Medium
- **Category:** Security
- **File:** `app/iam/config/boot.rb:5` (and equivalent in every service's `boot.rb`)
- **Description:** Every service's `boot.rb` begins with `require "pry"` regardless of `APP_ENVIRONMENT`. The Dockerfile builds with `BUNDLE_WITHOUT="development test"` for production, but `pry` is in the default group of the Gemfile (confirmed by the common audit's F-013), so it is installed in production images.
- **Impact:** (1) A stray `binding.pry` left in code will hang a puma worker indefinitely in production with no REPL attached, causing silent request stalls. (2) Larger attack surface / image size. (3) Signals dev tooling is not isolated from runtime.
- **Evidence:**
  ```ruby
  # app/iam/config/boot.rb
  require "dotenv"
  require "pry"
  ```
- **Recommendation:** Move `pry` (and `pry-byebug` etc.) to the `:development` group in every Gemfile, and gate the `require` behind `if ENV["APP_ENVIRONMENT"] == "development"`. Remove the unconditional `require "pry"` from all `boot.rb` files.
- **Effort:** S

## INFRA-P03 — Containers run as root; no `USER`, no `read_only`
- **Severity:** Medium
- **Category:** Deployment
- **File:** `app/*/Dockerfile` (all services, e.g. `app/iam/Dockerfile`)
- **Description:** No Dockerfile declares a non-root `USER`, and no `docker-compose.yml` sets `user:`. The final `CMD ["bundle", "exec", "puma"]` runs as root inside the container.
- **Impact:** A container escape or RCE vulnerability in puma/Sequel/Verse gains root inside the container, increasing blast radius. Combined with bind-mounted source in dev, this also means file writes from the container are owned by root on the host.
- **Evidence:** `app/iam/Dockerfile` has no `USER` directive; ends with `CMD ["bundle", "exec", "puma"]`.
- **Recommendation:** Create a non-root user in each Dockerfile (`RUN useradd -m app && chown -R app /app` then `USER app`), and consider `read_only: true` with explicit `tmpfs` mounts in production compose. This is a standard hardening step.
- **Effort:** M

## INFRA-P04 — `on_worker_boot` restarts event manager but not Sequel DB connection
- **Severity:** Medium
- **Category:** Reliability
- **File:** `app/*/config/puma.rb:15-18`
- **Description:** When `PUMA_WORKERS > 1`, the puma config forks workers and calls `Verse.event_manager.restart` in `on_worker_boot`, but never reconnects the Sequel `DB` object. With `preload_app!`, the parent process opens the DB connection before forking; child workers inherit file descriptors to the same Postgres backend. Under load this can cause protocol desync, "unexpected message" errors, or transactions interleaving across workers.
- **Impact:** Multi-worker deployments (the intended production scaling path) are unreliable. Single-worker mode (the default `PUMA_WORKERS=1`) is unaffected, which is likely why this hasn't surfaced.
- **Evidence:**
  ```ruby
  on_worker_boot do
    Verse.event_manager.restart
    # ← no DB.disconnect / reconnect
  end
  ```
- **Recommendation:** Add `Sequel::Model.db.disconnect` (or `Verse::Sequel.db.disconnect` per the framework's accessor) inside `on_worker_boot` so each worker re-establishes its own connection. Verify the exact accessor against the Verse sequel plugin.
- **Effort:** S

## INFRA-P05 — No boot-time validation of required env vars
- **Severity:** Medium
- **Category:** Config
- **File:** `app/*/config/config.yml` (e.g. `app/iam/config/config.yml:18,21,47-48`)
- **Description:** Config uses `ENV.fetch("DATABASE_URI")`, `ENV.fetch("REDIS_STREAM_URL")`, `ENV.fetch("IDAH_SERVICE_ACCOUNT")`, `ENV.fetch("IDAH_SERVICE_PASSWORD")` without defaults. `ENV.fetch` raises `KeyError` at config load time, which is good, but the error message is the raw `KeyError` from deep inside the YAML ERB evaluation — not a clear "missing required env var" message at boot. Worse, some vars use `ENV.fetch("X", "default")` with insecure defaults (e.g. `LOG_SHOW_ERROR_DETAILS` defaults to `"true"` in `config.yml:9`).
- **Impact:** Misconfigured production depots fail with cryptic errors. `LOG_SHOW_ERROR_DETAILS=true` as the default means error details leak in responses unless explicitly overridden.
- **Evidence:**
  ```yaml
  # app/iam/config/config.yml
  plugins:
    - name: http
      config:
        show_error_details: <%= ENV.fetch("LOG_SHOW_ERROR_DETAILS", "true") %>
  ```
- **Recommendation:** (1) Add an explicit `ENV.fetch(...)` validation block at the top of `boot.rb` (or a dedicated `config/initializers/00_env_check.rb`) that lists required vars and raises a clear error. (2) Change `LOG_SHOW_ERROR_DETAILS` default to `"false"` — production should opt in, not opt out.
- **Effort:** S

## INFRA-P06 — SSH private key materialized on runner; `gcloud` CLI unpinned
- **Severity:** Medium
- **Category:** Security
- **File:** `.github/workflows/cd-docs.yml:79-95`
- **Description:** The deploy job writes `GCP_IDAH_WEBSITE_VM_SSH_KEY` (a private key) to `~/.ssh/google_compute_engine` on the GitHub-hosted runner, then uses `gcloud compute ssh` with `sudo docker compose`. The `gcloud` CLI is not installed by a pinned setup action (only `google-github-actions/auth@v3` is used, which authenticates the JSON key but does not install/pin the `gcloud` SDK — it relies on the runner's pre-installed, auto-updating version).
- **Impact:** (1) The SSH private key is on disk for the duration of the job; a compromised later step could exfiltrate it. (2) Unpinned `gcloud` means a breaking change in the CLI silently breaks deploys. (3) `sudo docker compose` over SSH gives the deploy identity broad root access on the VM.
- **Evidence:**
  ```yaml
  - name: Setup SSH Key for VM
    run: |
      echo "${{ secrets.GCP_IDAH_WEBSITE_VM_SSH_KEY }}" > ~/.ssh/google_compute_engine
      ...
  - name: Update Docs Website on VM
    run: |
      gcloud compute ssh ${{ env.INSTANCE_NAME }} \
        --command="cd ... && sudo docker compose pull && sudo docker compose up -d"
  ```
- **Recommendation:** (1) Prefer `google-github-actions/setup-gcloud@v2` with a pinned version to make the CLI explicit. (2) Consider OS Login + short-lived credentials instead of a long-lived SSH key. (3) Restrict the VM service account / sudoers rule so `docker compose` is the only elevated command allowed.
- **Effort:** M

## INFRA-P07 — `actions/checkout@v6` does not exist
- **Severity:** Low
- **Category:** Deployment
- **File:** `.github/workflows/cd-docs.yml:25, 72`
- **Description:** `actions/checkout@v6` is referenced, but the highest stable major version of `actions/checkout` is v4 (as correctly used in `ci.yml`). v6 does not exist.
- **Impact:** If `cd-docs.yml` is dispatched (`workflow_dispatch`), both jobs will fail at the checkout step. The workflow has likely never been run, or is run so rarely the breakage went unnoticed.
- **Evidence:** `uses: actions/checkout@v6` (lines 25 and 72) vs `uses: actions/checkout@v4` in `ci.yml`.
- **Recommendation:** Change to `actions/checkout@v4`. Also pin `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/build-push-action@v7`, `actions/cache@v5`, `google-github-actions/auth@v3` to SHA digests for supply-chain hardening.
- **Effort:** S

## INFRA-P08 — `wget`/`git`/`curl` installed in production runtime image
- **Severity:** Low
- **Category:** Deployment
- **File:** `app/*/Dockerfile:6-18` (e.g. `app/iam/Dockerfile`)
- **Description:** The runtime image installs `curl`, `wget`, and `git`. These are useful at build time but are not needed by puma at runtime.
- **Impact:** Increases image size and attack surface (a post-compromise attacker has download tools readily available). Minor.
- **Evidence:**
  ```dockerfile
  RUN apt-get update && apt-get install -y \
      build-essential pkg-config libpq-dev curl wget git ...
  ```
- **Recommendation:** Use a multi-stage build: install build deps in a builder stage, copy only the compiled gems into a slim final stage that lacks `curl`/`wget`/`git`/`build-essential`. Keep `libpq-dev` runtime libs as needed.
- **Effort:** M

---

## Dev-only findings (for awareness, not production blockers)

- **INFRA-D01** — `docker-compose-db.yml:9-14`: dev Postgres on `0.0.0.0:5432` with `postgres:postgres`. Dev-only; documented in `SECURITY.md`.
- **INFRA-D02** — `docker-compose-db.yml:17-25`: dev Redis on `0.0.0.0:6379` with no auth. Dev-only.
- **INFRA-D03** — `dev/nginx/nginx.conf:67-71`: dev nginx sets `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, HSTS, but no CSP / `Referrer-Policy` / `Permissions-Policy`. Production nginx config is not in this repo (deployed separately), so this is a dev-only note.
- **INFRA-D04** — `dev/nginx/nginx.conf`: no `limit_req` zones on `/api/v1/iam/auth` or `/api/v1/media`. Dev-only; production should add rate limiting.
- **INFRA-D05** — `SECURITY.md:29-34`: dev defaults (`admin@idah.ai`/`P@ssword01`, committed JWT keys, self-signed cert) are documented as insecure. Good that it's documented; ensure production deploy scripts never inherit these.

---

## Files reviewed

- `docker-compose.yml`, `docker-compose-db.yml`
- `dev/nginx/nginx.conf`
- `.github/workflows/ci.yml`, `.github/workflows/cd-docs.yml` (ci-docs.yml, ci-plugins.yml not read in detail — they appear to be doc/plugin lint only)
- `app/iam/Dockerfile`, `app/iam/dev-entrypoint.sh`, `app/iam/config/{boot.rb,puma.rb,config.yml,config.development.yml}`
- `SECURITY.md`
- Spot-checked that other services share the same Dockerfile/boot/puma pattern (confirmed via `list_directory` and prior service audits).

No code was modified — report only.
