# Media Service Audit

## Status: Complete

Auditing `idah/app/media/` — file storage, processing jobs, video processing, processor plugins.

---

## Executive Summary

The Media service implements file upload/download (Shrine/S3), a job system with scheduler + thread pool, a processor plugin registry, and a video processing service. The architecture broadly follows the Verse layered pattern (Expo → Service → Repository), and repositories correctly implement auth scoping. However, the audit surfaced several significant issues: (1) the `Video::Service` references a `Video::Job` class that does not exist anywhere in the codebase, meaning video processing is broken at runtime; (2) the global `EXECUTOR` (ffmpeg runner) is initialized and started but never actually invoked by any service code; (3) the `Executor#call` API uses `Open3.popen3` with a shell-interpolated command string, which is a command-injection risk if/when wired to user-influenced input; (4) the `Processor::Job` uses `Verse::Util::Reflection.constantize` on job arguments (`processor_class_name`, `options_class_name`) that originate from the DB, enabling arbitrary class instantiation if a job row is poisoned; (5) file uploads stream the entire file into memory via `storage.upload(file.tempfile)` with no size limit or streaming; (6) the `Medias::Service` declares `use_system video_service:` but never uses it (dead code); and (7) several smaller code smells (`puts` debug statements, swallowed exceptions, missing timeouts on subprocess execution, unbounded default pagination of 1000 items). No hardcoded UUIDs or hardcoded resource strings were found. Findings are detailed below.

---

## Findings

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| M-01 | Critical | Architecture / Bug | `app/service/video/service.rb:12` | `Video::Job` class referenced but never defined — video processing is broken |
| M-02 | Critical | Security | `app/service/processor/job.rb:14-20` | Arbitrary class instantiation via `constantize` on DB-stored job arguments |
| M-03 | High | Security | `app/util/executor.rb:86` | `Open3.popen3` invoked with shell string — command injection risk |
| M-04 | High | Performance | `app/util/executor.rb:86-101` | No timeout on subprocess execution (ffmpeg can hang forever / zombie processes) |
| M-05 | High | Security / Performance | `app/service/medias/service.rb:47-49` | File upload loads entire file into memory; no size limit, no streaming |
| M-06 | High | Security | `app/expo/medias_expo.rb:54-61` | Download endpoint sets `Content-Type`/`Content-Length` from DB without revalidation — stored XSS / content-type spoofing |
| M-07 | Medium | Architecture | `app/service/processor/service.rb:5` | `use_system jobs:` bypasses auth scoping when creating processor jobs |
| M-08 | Medium | CodeSmell | `config/initializers/scheduler.rb:6`; whole codebase | Global `EXECUTOR` is started/stopped but never used — dead code |
| M-09 | Medium | CodeSmell | `app/service/medias/service.rb:6` | `use_system video_service:` declared but never called — dead code |
| M-10 | Medium | Performance | `app/service/jobs/scheduler.rb:79-147` | `process` rescues `StandardError` and re-raises after marking errored — exception propagates into thread pool, may kill worker |
| M-11 | Medium | CodeSmell | `app/service/video/service.rb:9` | `puts "Arguments = ..."` debug statement left in production code |
| M-12 | Medium | Performance | `app/service/processor/context.rb:30` | `download_original` reads entire file into memory via `file.read` |
| M-13 | Medium | Security | `app/model/medias.rb:103-115` | Auth scoping makes synchronous HTTP calls to IAM/Dataset per request (N+1 / latency) |
| M-14 | Low | CodeSmell | `app/service/jobs/scheduler.rb:100-101` | `reschedule` called with positional `"pending"` but repo signature uses keyword `status:` — likely a bug |
| M-15 | Low | CodeSmell | `app/model/jobs.rb:116-122` | `next_scheduled_time` returns raw `[:min]` — may be `nil` and breaks scheduler wait math silently |
| M-16 | Low | CodeSmell | `app/service/jobs/base.rb:30-34` | `emit` calls `@command.call` but `@command` may be nil if `emit` invoked before `run` |
| M-17 | Low | CodeSmell | `app/service/processor/context.rb:103-105` | `reschedule!` / `error!` delegate to `job.reschedule!` / `job.error!` but `Jobs::Base` defines `reschedule` / `error` (no bang) — NoMethodError |
| M-18 | Low | Performance | `app/service/jobs/service.rb:7`; `medias/service.rb:8` | Default `items_per_page: 1000` — unbounded default pagination |
| M-19 | Low | CodeSmell | `config/initializers/scheduler.rb:13` | `puts ENV["PUMA_WORKERS"]` debug output on every boot |
| M-20 | Low | Security | `config/initializers/set_keys.rb:12-17` | JWT key path accepts raw key content from env without validation of format origin |
| M-21 | Info | Architecture | `app/expo/jobs_expo.rb:3` | `JobsExpo` extends `Verse::Exposition::Base` directly instead of `BaseExpo` (skips JSON:API renderer) |
| M-22 | Info | CodeSmell | `app/service/processor/service.rb:48` | `# TODO: what to do with multiple job ids?` — only last job_id is stored on entry, others orphaned |
| M-23 | Info | CodeSmell | `app/model/medias.rb:62` | `# TODO: background processors also trigger this event…` — known unresolved issue |

---

## Detailed Findings

### M-01 — `Video::Job` class referenced but never defined (Critical)

**Description.** `Video::Service#process` enqueues a job with `job_class: "Video::Job"`. When the scheduler picks it up, `Jobs::Scheduler#process` calls `Verse::Util::Reflection.constantize("Video::Job")`. There is no `Video::Job` class defined anywhere in `app/media/app/service/video/` (only `service.rb`) or elsewhere in the project. The scheduler guards with `unless klass < Jobs::Base`, but constantizing a missing constant will raise `NameError` before that check runs.

**Impact.** Any call to `Video::Service#process` results in a job that will permanently fail (errored state) on first execution. Video processing is non-functional. The exception is swallowed by the scheduler's `rescue StandardError` and recorded as `error` on the job row, so the failure is silent unless someone inspects job state.

**Evidence.** `app/service/video/service.rb:11-15`:
```ruby
job_service.create(
  "Video::Job",
  arguments:,
  unicity: "video:vp_#{arguments[:resource]}"
)
```
`app/service/jobs/scheduler.rb:80`:
```ruby
klass = Verse::Util::Reflection.constantize(job.job_class)
```
No `class Job` exists under `Video::` (only `Video::Service`).

**Recommendation.** Either implement `Video::Job < Jobs::Base` (with `run_impl` invoking ffmpeg via `EXECUTOR`) or remove `Video::Service` entirely if unused. Given that `EXECUTOR` is also unused (M-08), the entire video subsystem appears to be scaffolding that was never completed.

**Effort.** M (implement the job) or S (remove dead code).

---

### M-02 — Arbitrary class instantiation via `constantize` on DB job arguments (Critical)

**Description.** `Processor::Job#run_impl` reads `processor_class_name` and `options_class_name` directly from the job's `arguments` JSONB column and calls `Verse::Util::Reflection.constantize(...)` on them, then `processor_class.new(context)` and `options_class.new(**options)`. The job arguments are written by `Processor::Service#process_entry` from the `Processor::Registry`, but the registry is populated by **plugins** loaded from disk (`plugins/**`), and the job row is stored in a JSONB column with no integrity constraint on the class names.

**Impact.** If an attacker can write to the `jobs` table (SQL injection elsewhere, a compromised plugin, a migration bug, or a privileged account with job-create rights), they can set `processor_class_name` to any constant (e.g. `Kernel`, `IO`, `ActiveSupport::TestCase`, …) and have it instantiated with a `Processor::Context`. Even without DB write access, a malicious plugin loaded via `IDAH_PLUGIN_PATH` can register arbitrary class names. Unlike `Jobs::Scheduler#process` (which validates `klass < Jobs::Base`), `Processor::Job` performs **no** superclass check on either `processor_class` or `options_class`.

**Evidence.** `app/service/processor/job.rb:14-20`:
```ruby
processor_class = Verse::Util::Reflection.constantize(
  processor_class_name
)
options_class = Verse::Util::Reflection.constantize(
  options_class_name
)
```

**Recommendation.** Add allowlist validation: only resolve classes that are registered in `Processor::Registry`, and assert `processor_class < Processor::Base` (introduce such a base) and `options_class < Verse::Schema::Dataclass` before instantiation. Do not trust the DB-stored class name strings.

**Effort.** M.

---

### M-03 — `Open3.popen3` with shell string — command injection risk (High)

**Description.** `Executor#call_async` builds a command string via `escape(command, **opts)` (which uses `Shellwords.escape` on interpolated values) and then passes the resulting **string** to `Open3.popen3(escaped_command, popen_opts)`. When `popen3` receives a string, it is executed via `/bin/sh -c`, so any unescaped shell metacharacter that survives the `escape` step is interpreted by the shell. The `escape` method only escapes values interpolated via `%<name>s` / `%{name}` placeholders; if a caller passes a pre-formed command string with no placeholders (as the spec does: `executor.call("echo 'hello'")`), no escaping happens at all.

**Impact.** Currently no caller in the media service invokes `EXECUTOR` (see M-08), so this is latent. The moment a plugin or `Video::Job` is implemented and passes user-influenced filenames, URLs, or metadata into a command template without a placeholder, arbitrary shell execution is possible. The API is footgun-shaped: it accepts a free-form string rather than an `argv` array.

**Evidence.** `app/util/executor.rb:83-86`:
```ruby
escaped_command = escape(command, **opts)

@pool.run do
  Open3.popen3(escaped_command, popen_opts) do |stdin, stdout, stderr, wait_thr|
```
Spec usage showing unescaped raw command: `executor.call("echo 'hello'")`.

**Recommendation.** Change the API to accept an `argv` array and pass it to `Open3.popen3(*argv)` (no shell). If a string template API is kept, document that **every** user-influenced value must go through a `%<name>s` placeholder and add a rubocop/test guard against raw interpolation.

**Effort.** M.

---

### M-04 — No timeout on subprocess execution (High)

**Description.** `Executor#call_async` runs `Open3.popen3` and waits on `wait_thr.value` with no timeout. If the subprocess (ffmpeg, etc.) hangs (e.g. on a malformed video, a network-mounted input, or a deadlock), the worker thread blocks forever, the `@pool` slot is consumed, and eventually the executor's 4 slots are exhausted. There is no `Process.kill`, no `Timeout.timeout`, and no watchdog.

**Impact.** Zombie/hung processes accumulate, the ffmpeg executor silently stalls, and jobs remain in `running` status forever (the scheduler's `lock_available` only pulls `pending` rows, so stuck `running` jobs are never reclaimed). This is the classic "ffmpeg hung on bad input" failure mode.

**Evidence.** `app/util/executor.rb:86-97` — no timeout around `wait_thr.value`.

**Recommendation.** Wrap with `Timeout.timeout(max_seconds)` or use `wait_thr.join(max_seconds)` + `Process.kill("TERM", wait_thr.pid)` on expiry, then `"KILL"` after a grace period. Make the timeout configurable per call.

**Effort.** M.

---

### M-05 — File upload loads entire file into memory; no size limit (High)

**Description.** `Medias::Service#upload` calls `storage.upload(file.tempfile)`. While Shrine itself streams from the Tempfile to S3, the HTTP layer (`Verse::Http::UploadedFile`) buffers the entire upload into a Tempfile on disk before this point, and there is no `max_size` validation anywhere in the upload pipeline. The `Shrine.plugin :determine_mime_type` initializer is present but `:validation_helpers` / `validate_max_size` are not. A malicious or accidental large upload can fill disk or exhaust memory.

**Impact.** DoS via large uploads; no enforcement of project/org quotas.

**Evidence.** `app/service/medias/service.rb:47-49`:
```ruby
output = storage.upload(
  file.tempfile
)
```
`config/initializers/shrine.rb` only enables `:determine_mime_type` — no size validation.

**Recommendation.** Add `Shrine.plugin :validation_helpers` and `validate_max_size` in the shrine initializer; enforce a content-type allowlist; consider streaming uploads direct-to-S3 (presigned URLs) to avoid buffering.

**Effort.** M.

---

### M-06 — Download endpoint trusts DB-stored `mime_type` / `size` (High)

**Description.** `MediasExpo#download` sets `renderer.content_type = media.mime_type` and `Content-Length` directly from the DB record, then streams the raw bytes from S3. The `mime_type` is set at upload time from `output.mime_type` (Shrine's `determine_mime_type`, which uses `file --mime-type`) **or** from the client-supplied value in `Processor::Context#upload_media` (`mime_type || file.mime_type`). There is no revalidation on download, and no `Content-Disposition: attachment` header, so a browser will render HTML/SVG/image content inline in the origin of the media service.

**Impact.** Stored XSS: an attacker uploads an HTML file (or SVG with embedded script), the service stores `text/html`, and a victim browsing the download URL executes the script in the service origin. Also enables content-type spoofing for downstream consumers.

**Evidence.** `app/expo/medias_expo.rb:57-58`:
```ruby
renderer.content_type = media.mime_type
server.response.headers["Content-Length"] = media.size
```

**Recommendation.** Force `Content-Disposition: attachment; filename="..."` on all downloads, or restrict the served `Content-Type` to a safe allowlist (images, video, application/octet-stream). Re-derive mime type from the bytes on download rather than trusting the DB.

**Effort.** S.

---

### M-07 — `use_system jobs:` bypasses auth scoping when creating processor jobs (Medium)

**Description.** `Processor::Service` declares `use_system jobs: Jobs::Repository`, which instantiates the jobs repository with a system auth context. `process_entry` then creates `Processor::Job` rows via this system repo. Per the project's Golden Rule #2, `use_system` should be reserved for unavoidable cases (e.g. workflow transitions reassigning entries). Here it is used because the call is triggered by an event handler (`ProcessorExpo#on_entry_created`) which may run without a user context.

**Impact.** Jobs are created without org/project scoping. The `Jobs::Repository#scoped` for `:create` is moot (system bypasses it), but more importantly the job's `arguments` contain a `resource` and `entry_id` that are not validated against the caller's permissions — any event that fires `entries.created` triggers processor job creation regardless of whether the actor should be allowed to process that entry.

**Recommendation.** Propagate the original actor's auth context through the event metadata, or explicitly assert the entry's project matches an allowed scope before enqueueing.

**Effort.** M.

---

### M-08 — Global `EXECUTOR` is started/stopped but never used (Medium)

**Description.** `config/initializers/scheduler.rb` creates `EXECUTOR = Executor.new(4)` and starts/stops it on boot/shutdown and in `puma.rb` `on_worker_boot`. A grep for `EXECUTOR\.` across the entire codebase shows only `.start` and `.stop` calls — no `EXECUTOR.call` or `EXECUTOR.call_async` anywhere. The intended consumer (`Video::Job`, see M-01) was never implemented.

**Impact.** Four worker threads are spawned per process for no purpose; memory + scheduling overhead. Misleading: future maintainers may assume ffmpeg is wired up.

**Recommendation.** Remove `EXECUTOR` until `Video::Job` is implemented, or implement `Video::Job` to use it.

**Effort.** S.

---

### M-09 — `use_system video_service:` declared but never called (Medium)

**Description.** `Medias::Service` declares `use_system video_service: Video::Service` but no method on `Medias::Service` ever references `video_service`. Dead dependency injection.

**Evidence.** `app/service/medias/service.rb:6`:
```ruby
use_system video_service: Video::Service
```
No other reference to `video_service` in the file.

**Recommendation.** Remove the line, or wire it up if video processing is meant to be triggered from media upload.

**Effort.** S.

---

### M-10 — Scheduler `process` rescues and re-raises after marking errored (Medium)

**Description.** `Jobs::Scheduler#process` wraps the thread-pool job in:
```ruby
rescue StandardError => e
  jobs.error(job.id, error: [e.class.name, e.message].join(": "))
  raise e
end
```
The `raise e` propagates into `ThreadPool#run`, which (depending on the common `ThreadPool` implementation) may either swallow it or kill the worker thread. Combined with M-04 (no subprocess timeout), a stuck ffmpeg can leave the worker blocked, and an unexpected exception can leave the pool shrinking.

**Impact.** Thread pool may degrade over time; error is double-handled (recorded on the job AND raised).

**Recommendation.** Don't re-raise after recording the error — the job has already been marked errored. Let the thread pool continue. Or, if re-raising is intentional for crash visibility, document why.

**Effort.** S.

---

### M-11 — `puts` debug statement in `Video::Service` (Medium)

**Description.** `app/service/video/service.rb:9`:
```ruby
puts "Arguments = #{arguments.inspect}"
```
Logs to stdout on every call, bypassing `Verse.logger`, with no level filtering. Arguments may contain sensitive resource IDs.

**Recommendation.** Replace with `Verse.logger&.debug{ ... }` or remove.

**Effort.** S.

---

### M-12 — `download_original` reads entire file into memory (Medium)

**Description.** `Processor::Context#download_original` does:
```ruby
tempfile.write(file.read)
```
`file.read` slurps the entire S3 object into memory before writing to the Tempfile. For large media (videos, datasets) this causes memory spikes in the processor worker.

**Recommendation.** Stream with `IO.copy_stream(file, tempfile)` or read in chunks.

**Effort.** S.

---

### M-13 — Auth scoping makes synchronous HTTP calls per request (Medium)

**Description.** `Medias::Repository#project_from_orgs_scoped` and `#project_from_memberships_scoped` call `Api[:idah].dataset.projects.index(...)` and `Api[:idah].dataset.project_members.index(...)` on **every** scoped query. These are synchronous HTTP round-trips to the Dataset service. Combined with the default 1000-item pagination, a single `GET /medias` triggers 1-2 internal HTTP calls plus a DB query.

**Impact.** Latency amplification; tight coupling between Media and Dataset availability (if Dataset is down, Media auth scoping fails and all reads error).

**Recommendation.** Cache org/project memberships in Redis with a short TTL, or denormalize `project_id` / `org_id` onto the `medias` row and scope by DB column directly.

**Effort.** L.

---

### M-14 — `reschedule` called with mismatched signature (Low)

**Description.** `Jobs::Scheduler#process` line 101:
```ruby
jobs.reschedule(job.id, "pending", scheduled_at: reschedule_in)
```
But `Jobs::Repository#reschedule` signature is:
```ruby
def reschedule(id, scheduled_at: nil, error: nil)
```
There is no positional second argument; the literal `"pending"` is passed as `scheduled_at` (a String), and the actual `scheduled_at:` keyword overrides it. The status is hardcoded to `"pending"` inside the repo method, so the call works by accident, but the `"pending"` argument is dead and confusing.

**Recommendation.** Remove the stray `"pending"` positional argument.

**Effort.** S.

---

### M-15 — `next_scheduled_time` returns raw `[:min]` (Low)

**Description.** `app/model/jobs.rb:116-122` returns `first[:min]`, which is `nil` when no pending jobs exist. The scheduler handles `nil` correctly (`if time.nil?`), but the column alias is implicit and fragile.

**Recommendation.** Use `Sequel.cast(...).as(:min)` or `select(Sequel.function(:min, :scheduled_at).as(:min))` for clarity.

**Effort.** S.

---

### M-16 — `emit` may call nil `@command` (Low)

**Description.** `Jobs::Base#emit` calls `@command.call(...)`. `@command` is only set inside `run(&block)`. If a subclass calls `update_progress` / `reschedule` / `error` outside the `run` block (e.g. in an `initialize` or a callback set up before `run`), `@command` is `nil` and `NoMethodError` is raised.

**Recommendation.** Default `@command` to a lambda that raises a clear error, or assert presence in `emit`.

**Effort.** S.

---

### M-17 — `Context#reschedule!` / `error!` call non-existent bang methods (Low)

**Description.** `Processor::Context` defines:
```ruby
def reschedule!(after: 10)
  job.reschedule!(after:)
end
def error!(message)
  job.error(message)
end
```
But `Jobs::Base` defines `reschedule(after:)` (no bang) and `error(message)`. `job.reschedule!(after:)` will raise `NoMethodError` if any processor plugin calls `context.reschedule!`.

**Recommendation.** Rename to match (`reschedule`), or add the bang aliases on `Jobs::Base`.

**Effort.** S.

---

### M-18 — Default `items_per_page: 1000` (Low)

**Description.** `Jobs::Service#index`, `Medias::Service#index`, and `Processor::Service` (via Dataset API) all default to 1000 items per page. A caller can request up to the framework's max. Combined with M-13 (HTTP calls per scope), this can produce very large responses and high latency.

**Recommendation.** Lower the default (e.g. 50–100) and enforce a hard cap.

**Effort.** S.

---

### M-19 — `puts ENV["PUMA_WORKERS"]` on boot (Low)

**Description.** `config/initializers/scheduler.rb:13` unconditionally prints the env var on every boot. Clutter in container logs.

**Recommendation.** Use `Verse.logger&.debug` or remove.

**Effort.** S.

---

### M-20 — JWT key accepts raw env content without origin validation (Low)

**Description.** `config/initializers/set_keys.rb:11-17` accepts either `file:/path` or the raw key string from `SERVICE_JWT_KEY`. If someone forgets the `file:` prefix and points to a path, the path itself is fed into `OpenSSL::PKey::EC.new`, which will raise an opaque error.

**Recommendation.** Auto-detect: if the value contains `BEGIN ... PRIVATE KEY` or matches a PEM header, treat as content; otherwise treat as a path. Log which mode was selected.

**Effort.** S.

---

### M-21 — `JobsExpo` does not extend `BaseExpo` (Info)

**Description.** `JobsExpo < Verse::Exposition::Base` directly, while `MediasExpo` and `ProcessorExpo` (via `BaseExpo`) set `Verse::JsonApi::Renderer` as the renderer. `JobsExpo` uses `json_api Jobs::Record do ... end` so it likely works, but it bypasses the project-local `BaseExpo` convention and won't pick up future cross-cutting changes to `BaseExpo`.

**Recommendation.** Change to `class JobsExpo < BaseExpo` for consistency.

**Effort.** S.

---

### M-22 — Multiple processor jobs per entry; only last `job_id` stored (Info)

**Description.** `Processor::Service#process_entry` loops over `processor_entries` and creates a job per processor, but `Api[:idah].dataset.entries.update(... job_id: job_id)` inside the loop overwrites `job_id` each iteration. Only the last processor's job id is stored on the entry; the others are orphaned (still runnable, but not linked).

**Recommendation.** Either store an array of job ids, or create a single composite job that runs all processors sequentially.

**Effort.** M.

---

### M-23 — Unresolved TODO about background processors and audit events (Info)

**Description.** `app/model/medias.rb:62`:
```ruby
# TODO: background processors also trigger this event and causing error logs on audit as there's no actor id
```
Known issue: processor-created medias publish events with no actor metadata, causing audit-service errors.

**Recommendation.** Suppress event metadata population when `auth_context.metadata[:id]` is nil, or attribute processor actions to a dedicated service account.

**Effort.** S.

---

## Positive Observations

- **Auth scoping is implemented** in both `Jobs::Repository#scoped` and `Medias::Repository#scoped` with proper org/project/user branches — no obvious bypass besides the documented `use_system` cases.
- **`Jobs::Scheduler#process` validates `klass < Jobs::Base`** before instantiating job classes — good defense against poisoned job rows (note: `Processor::Job` does **not** do the same for its `processor_class`/`options_class`, see M-02).
- **`Jobs::Scheduler` uses `MonitorMixin`** and condition variables correctly for thread-safe signaling.
- **`lock_available` uses `FOR UPDATE SKIP LOCKED`** — correct concurrency primitive for job claiming.
- **No hardcoded UUIDs** — `SecureRandom.uuid` is not used; UUIDs come from the DB's `uuid_generate_v7()` default.
- **Resource constants** (`Resource::Media::Jobs`, `Resource::Media::Medias`, `Resource::Dataset::Entries`) are used consistently rather than hardcoded strings.
- **Exponential backoff with jitter** is implemented for job retries (`scheduler.rb:115`).
- **No raw `system`, backticks, or `IO.popen`** — the only subprocess API is `Open3.popen3` via `Executor` (M-03).
- **Shrine `:determine_mime_type`** is enabled (real mime sniffing, not client-supplied) — though it's not revalidated on download (M-06).
