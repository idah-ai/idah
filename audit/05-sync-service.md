# Sync Service Audit

## Executive Summary

The Sync service generates dataset exports (currently only UPD format via the `updcli-static` external binary) and exposes them through `ExportsExpo` and `JobsExpo`. The job system uses a `Scheduler` + `ThreadPool` with `MonitorMixin` synchronization, `SELECT FOR UPDATE SKIP LOCKED` for job acquisition, and an exponential-backoff retry policy. The architecture is generally well-layered (Expo → Service → Repository), and auth scoping is implemented in both repositories. However, the audit surfaced several serious issues:

- **Critical command injection** in `Exports::Upd::Exporter` — every `system()` call interpolates user-controlled dataset/entry/annotation/media metadata into the shell without escaping, despite the project shipping an `Executor` class specifically designed for safe shell escaping.
- **Critical missing authz on export download** — the `/exports/:id/download` endpoint calls `service.show` which goes through the scoped repository, but the streaming response path is fine; however the `export` (POST) endpoint and the `JobsExpo` `index` rely on scoping that has correctness gaps (see findings).
- **High-severity IDOR / scoping bypass** — `Exports::Repository#scoped` for `as_org_owner` returns an **empty** `project_ids` array (no `org`/`project` custom scope is ever set in this service), silently denying access for org-owners in the common case, while the `as_user` branch makes a per-request cross-service call to the Dataset service to enumerate projects.
- **High-severity unbounded memory** — `DatasetContext#entries`, `EntryContext#annotations`, and `EntryContext#medias` use `index_all(...).map { ... }`, loading every entry/annotation/media of a dataset into memory at once; combined with the UPD exporter downloading every media binary into memory (`bin_data = media.download`) this can OOM the worker on large datasets.
- **High-severity concurrency / duplicate execution** — the scheduler's `process` is dispatched inside `synchronize` (the `available_jobs.each(&method(:process))` runs while holding the scheduler monitor), and `@thread_pool.run` enqueues work; combined with `lock_available` only flipping status to `running` inside its own transaction, a crash between `lock_available` and `process` leaves jobs stuck in `running` forever (no reaper, no stale-job recovery).
- Multiple medium issues: missing timeout on `updcli-static` invocations, `use_system_repo`-style bypass in `Exports::Job` (instantiates `Exports::Service.new(Verse::Auth::Context.new)` with a system context), `File.open` without closing in `IoContext#zip_directory`, hardcoded `/tmp` path with predictable name (TOCTOU/symlink risk), and `Content-Disposition` filename not escaped.

The full findings table and details follow.

---

## Findings Table

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| SYNC-001 | Critical | Security | `app/service/exports/upd/exporter.rb:14,76-83,115-122,140-149,165-172` | Command injection via unsanitized user data in `system()` calls |
| SYNC-002 | Critical | Security | `app/service/exports/upd/exporter.rb:11` | Predictable `/tmp` export path (symlink/TOCTOU, race between concurrent jobs) |
| SYNC-003 | High | Security | `app/expo/exports_expo.rb:36` | `Content-Disposition` filename not escaped (header injection) |
| SYNC-004 | High | Security | `app/model/exports.rb:34-71` | `scoped` for `as_org_owner` returns empty set when no `org`/`project` custom scope is set; cross-service call per request |
| SYNC-005 | High | Performance | `app/service/exports/dataset_context.rb:11-18`, `entry_context.rb:11-26` | Unbounded `index_all(...).map` loads entire dataset graph into memory |
| SYNC-006 | High | Performance | `app/service/exports/upd/exporter.rb:157` | Media binaries downloaded into memory (`bin_data = media.download`) |
| SYNC-007 | High | Architecture | `app/service/exports/job.rb:38` | Job instantiates `Exports::Service` with a system `Auth::Context`, bypassing scoping |
| SYNC-008 | High | JobSystem | `app/service/jobs/scheduler.rb:51-53` | `process` invoked while holding scheduler monitor; pool work enqueued under the lock |
| SYNC-009 | High | JobSystem | `app/service/jobs/scheduler.rb` (whole) | No stale-`running`-job recovery (crash between lock and complete orphans jobs) |
| SYNC-010 | Medium | Performance | `app/service/exports/service.rb:8` | Default `items_per_page: 1000` for `index` |
| SYNC-011 | Medium | CodeSmell | `app/service/exports/upd/exporter.rb:14,76,115,140,165` | `system(..., exception: true)` swallows stderr; no timeout |
| SYNC-012 | Medium | CodeSmell | `app/service/exports/io_context.rb:24,52` | `File.open` in `zip_directory` never closed; `cleanup_file` may double-close |
| SYNC-013 | Medium | CodeSmell | `app/service/exports/upd/exporter.rb:93-97` | `URI.join` with `ENV.fetch("IDAH_URL")` — no validation, possible bad URL |
| SYNC-014 | Medium | Architecture | `app/service/exports/job.rb:29` | `exports.index({ job_id: }, items_per_page: 1).first` — picks "first" export by DB order, fragile |
| SYNC-015 | Medium | Security | `app/service/jobs/scheduler.rb:80-86` | `constantize(job.job_class)` only checks `< Jobs::Base`; any subclass is allowed |
| SYNC-016 | Medium | CodeSmell | `app/service/jobs/scheduler.rb:113-115` | Retry math `5 * (2 ** (retry_count * 1.5)).to_i` uses float exponent then truncates |
| SYNC-017 | Medium | Performance | `app/model/exports.rb:44`, `app/model/jobs.rb:124-127,145-148` | Cross-service `Api[:idah].dataset.projects.index_all` called inside `scoped` on every query |
| SYNC-018 | Medium | CodeSmell | `app/service/exports/upd/exporter.rb:128-129` | Mutates `annotation.record.dimensions` via `delete(:type)` (destructive) |
| SYNC-019 | Low | CodeSmell | `app/service/exports/registry.rb:14,19` | Pattern matching `in Array` / `in String | Regexp` outside `case`/`in` — relies on Ruby 3 `in` as expression |
| SYNC-020 | Low | CodeSmell | `app/util/executor.rb` | `Executor` exists with proper `Shellwords.escape` but is unused by the UPD exporter |
| SYNC-021 | Low | Architecture | `app/expo/exports_expo.rb:71-77` | `formats` endpoint uses `auth_context.can!` but discards scope result (`scope.all? { formats }`) |
| SYNC-022 | Low | CodeSmell | `app/service/exports/service.rb:64-90` | `upload` uses `exports.table.db.after_rollback` — reaches into Sequel internals across layers |
| SYNC-023 | Low | CodeSmell | `config/initializers/scheduler.rb:12-15` | `puts ENV["PUMA_WORKERS"]` debug print at boot |
| SYNC-024 | Info | Architecture | `app/service/exports/service.rb:6` | `use_system jobs: Jobs::Service` — system repo used; acceptable here but flagged per golden rule |
| SYNC-025 | Info | CodeSmell | `db/migrations/20251114000000_create_initial_schema.rb:64` | `exports.id` is `bigserial` while `jobs.id` is `uuid`; `Record#id` typed as `String` — inconsistent |

---

## Detailed Findings

### SYNC-001 — Critical / Security — Command injection in UPD exporter

**File:** `app/service/exports/upd/exporter.rb:14, 76-83, 115-122, 140-149, 165-172`

**Description.** Every interaction with the `updcli-static` binary uses `system(...)` with string interpolation of values that originate from the Dataset service (dataset name, modality, entry `resource`, annotation JSON, media filename, mime type, etc.). None of these are escaped. A malicious or merely unusual dataset/entry/annotation name (e.g. `foo"; rm -rf /tmp; echo "`) escapes its quoted argument and runs arbitrary shell commands as the sync container user.

**Impact.** Remote code execution in the sync service container. An attacker who can create or edit a dataset/entry/annotation with a crafted `name`, `filename`, `mime_type`, or annotation `metadata` value can run arbitrary commands whenever any user triggers an export containing that record.

**Evidence.**
```ruby
system(
  "updcli-static --input #{file_path} " \
  "dataset create --id \"#{dataset.record.id}\" "\
  "--name \"#{dataset.record.name}\" "\
  "--modality #{dataset.record.modality} "\
  "--metadata '#{metadata.to_json}'",
  exception: true
)
```
`dataset.record.name` is fully user-controlled and is interpolated inside double quotes — a `"` in the name breaks out.

**Recommendation.**
1. Stop using `system()` with a built string. Use the array form `system("updcli-static", "--input", file_path, "dataset", "create", "--id", dataset.record.id, "--name", dataset.record.name, ...)` which avoids a shell entirely.
2. Or use the existing `Executor` class (`app/util/executor.rb`) which already does `Shellwords.escape` via its `escape` method — it is currently dead code (see SYNC-020).
3. Validate/whitelist `modality`, `mime_type`, etc. against a strict charset before passing them anywhere.

**Effort:** M (rewrite the five `system` call sites to use the array form or `Executor`; add tests with shell metacharacters).

---

### SYNC-002 — Critical / Security — Predictable `/tmp` export path

**File:** `app/service/exports/upd/exporter.rb:11`

**Description.**
```ruby
file_path = "/tmp/idah-export-#{Time.now.to_i}.upd"
```
The path is world-predictable (only second granularity) and lives in the shared `/tmp`. Two concurrent export jobs that start within the same second collide on the same file. Worse, on a multi-tenant or shared host any local user can pre-create `/tmp/idah-export-<timestamp>.upd` as a symlink to a sensitive file (e.g. `/etc/passwd`, an S3 credential file, or another job's output); the subsequent `updcli-static ... init` and writes will then follow the symlink and corrupt the target.

**Impact.** Local symlink attack → arbitrary file overwrite/read; cross-job data corruption when two exports race.

**Recommendation.** Use `Dir.mktmpdir("idah-export-")` (or `Tempfile.create("idah-export-", ".upd")` like `IoContext` already does) and place the file inside that private directory. Never write to a path derived only from `Time.now.to_i`.

**Effort:** S.

---

### SYNC-003 — High / Security — Unescaped `Content-Disposition` filename

**File:** `app/expo/exports_expo.rb:36`

**Description.**
```ruby
server.response.headers["Content-Disposition"] = "attachment;filename=#{export.filename}"
```
`export.filename` is set in `Exports::Service#upload` from `File.basename(file.path)` — i.e. the temp filename generated by the exporter. Today it is server-controlled, but the value is interpolated raw into an HTTP header. A `\r\n` in the filename (or a future code path that lets the user influence it) would allow HTTP response splitting / header injection. The filename is also not quoted per RFC 6266, so spaces or special characters break the header.

**Impact.** Header injection if filename ever becomes user-influenced; broken downloads for filenames with spaces/Unicode today.

**Recommendation.** Use RFC 6266 form: `attachment; filename="safe.bin"; filename*=UTF-8''<percent-encoded>`, and reject CR/LF in the value.

**Effort:** S.

---

### SYNC-004 — High / Security — `Exports::Repository#scoped` denies org-owners by default

**File:** `app/model/exports.rb:34-71`

**Description.** The `as_org_owner?` branch reads `auth_context.custom_scopes[:org]` and `[:project]`. If neither is set (which is the common case in this service — nothing in `config/initializers/` populates those custom scopes), `project_ids` falls through to `[]` and the scope becomes `table.where(project_id: [])`, i.e. **no rows**. The `as_user?` branch then never runs for the same request. The result: org-owners silently see zero exports unless their token happens to carry the right custom scope.

Additionally, both branches issue a synchronous cross-service HTTP call (`Api[:idah].dataset.projects.index_all` / `project_members.index_all`) **inside the repository scope**, which means every `index`/`show` query on exports (and jobs, see SYNC-017) fans out to the Dataset service. This is slow, fails closed only by accident, and couples the repository layer to a remote service.

**Impact.** Either silent denial of service for legitimate org-owners, or — if the custom scope is ever populated incorrectly — over-broad access. Performance: one extra HTTP round-trip per repository query.

**Recommendation.**
1. Decide explicitly what scopes the sync service expects on the auth token and document them; fail loud (raise) rather than returning an empty set when an org-owner lacks the required scope.
2. Cache the project-id resolution per request (or move it into the service layer where it can be batched/cached), instead of calling it from inside `scoped` on every query.

**Effort:** M.

---

### SYNC-005 — High / Performance — Unbounded in-memory enumeration of dataset graph

**File:** `app/service/exports/dataset_context.rb:11-18`, `app/service/exports/entry_context.rb:11-26`

**Description.**
```ruby
def entries(filter = {})
  Api[:idah].dataset.entries.index_all(
    filter: filter.merge(dataset_id: @record.id),
    included: []
  ).map { |entry| EntryContext.new(entry) }
end
```
`index_all` (despite its name) materializes the full result set, and `.map` builds an array of contexts. The UPD exporter then iterates `dataset.entries`, and for each entry calls `entry.annotations` and `entry.medias`, each of which is another `index_all(...).map`. For a dataset with N entries, M annotations per entry, K medias per entry, the worker holds N + N·M + N·K context objects plus their JSON:API payloads in memory simultaneously.

**Impact.** Worker OOM / crash on large datasets; the job then errors and (with `max_retries = 0` by default) is marked failed. No streaming.

**Recommendation.** Use a paginated/lazy enumerator (`Api[...].entries.each_page` or a streaming endpoint) and yield entries one at a time so the exporter can write-and-discard.

**Effort:** M.

---

### SYNC-006 — High / Performance — Media binaries loaded into memory

**File:** `app/service/exports/upd/exporter.rb:152-173`

**Description.**
```ruby
bin_data = media.download            # entire file content in a String
tempfile = Tempfile.new([...])
tempfile.binmode
tempfile.write(bin_data)
```
`MediaContext#download` calls `Api[:idah].media.medias.files(...)` which returns the full media binary. For a multi-GB DICOM/video this both exhausts memory and stalls the worker thread on a single slow download with no timeout.

**Impact.** OOM, worker stall, no timeout on the cross-service fetch.

**Recommendation.** Stream the response body directly to the tempfile (`HTTP.get(uri) { |res| File.open(path, 'wb') { |f| res.read_body { |chunk| f << chunk } } }`), and wrap with a timeout.

**Effort:** M.

---

### SYNC-007 — High / Architecture — Job bypasses auth scoping

**File:** `app/service/exports/job.rb:37-39`

**Description.**
```ruby
def exports
  @exports ||= Exports::Service.new(Verse::Auth::Context.new)
end
```
The export job runs with a fresh, empty system `Auth::Context`. This is intentional in the sense that the job needs to write the export record it already created, but it means **all** `Exports::Service` calls from inside the job (including `exports.index({ job_id: })` and `exports.upload`) bypass the repository's `scoped` checks entirely. If a future bug lets a job's `arguments` reference an arbitrary `export_id`, the job will happily write to it.

**Impact.** Any future job-argument tampering (e.g. via DB poisoning, which the scheduler guard in SYNC-015 is meant to defend against) gains full system-level access to the exports table.

**Recommendation.** Construct the auth context with the original `created_by_id`/project scope captured at job creation time (store them in `arguments`), so the job operates with the *creator's* rights rather than a blank system context.

**Effort:** M.

---

### SYNC-008 — High / JobSystem — Pool work enqueued while holding the scheduler monitor

**File:** `app/service/jobs/scheduler.rb:46-53, 79`

**Description.**
```ruby
synchronize do
  free = @thread_pool.free
  if free > 0
    available_jobs = jobs.lock_available(free)
    available_jobs.each(&method(:process))   # process → @thread_pool.run inside the lock
  end
  ...
  @wait_cond.wait(next_in)
end
```
`process` calls `@thread_pool.run { ... }`. If `ThreadPool#run` blocks when the pool is saturated (typical bounded-queue behavior), the scheduler holds the monitor for the entire duration, deadlocking `signal` (which also needs the monitor) and preventing any new `created`/`rescheduled` event from waking the loop.

**Impact.** Scheduler deadlock / stall under load; events from `JobsExpo#signal_on_created` queue up but cannot acquire the monitor.

**Recommendation.** Move `available_jobs.each(&method(:process))` *outside* the `synchronize` block — only the `lock_available` + `next_scheduled_time` + `wait` need to be atomic.

**Effort:** S.

---

### SYNC-009 — High / JobSystem — No recovery for stale `running` jobs

**File:** `app/service/jobs/scheduler.rb` (whole file), `app/model/jobs.rb`

**Description.** `lock_available` flips status `pending → running` inside a transaction, then `process` runs the job. If the worker process crashes (OOM from SYNC-005/SYNC-006, container restart, `kill -9`) between the status flip and `jobs.complete`/`jobs.error`, the job stays `running` forever. There is no `reaper`, no `stuck_running_after` sweep, and `lock_available` only selects `status: 'pending'`. The job is effectively lost.

**Impact.** Silent job loss on crash; exports that never complete and never retry.

**Recommendation.** On scheduler start (and periodically), requeue jobs in `running` whose `updated_at` is older than a TTL: `UPDATE jobs SET status='pending' WHERE status='running' AND updated_at < now() - interval '1 hour'`. Consider a heartbeat column.

**Effort:** M.

---

### SYNC-010 — Medium / Performance — Default page size 1000

**File:** `app/service/exports/service.rb:8`, `app/service/jobs/service.rb:7`

**Description.** `def index(... items_per_page: 1000 ...)` — a single call can return 1000 records with included relationships. There is no enforced maximum; a client can request `items_per_page=100000`.

**Recommendation.** Cap `items_per_page` server-side (e.g. `max 100`) and reject/normalize larger values.

**Effort:** S.

---

### SYNC-011 — Medium / CodeSmell — `system(..., exception: true)` swallows stderr and has no timeout

**File:** `app/service/exports/upd/exporter.rb:14, 76, 115, 140, 165`

**Description.** `system(cmd, exception: true)` raises `RuntimeError` on non-zero exit but does **not** capture stderr, so the actual error from `updcli-static` is lost. There is also no timeout — a wedged `updcli-static` hangs the worker thread indefinitely (and given SYNC-008, may hang the whole scheduler).

**Recommendation.** Use `Open3.capture3` (or the existing `Executor` which already wraps `Open3.popen3`) and a `Timeout.timeout`/`Process.daemon`-based kill.

**Effort:** S.

---

### SYNC-012 — Medium / CodeSmell — File handle leaks in `IoContext`

**File:** `app/service/exports/io_context.rb:24, 47-58, 67-72`

**Description.** `zip_directory` does `File.open(export_context.io.zip_directory)` in `job.rb:24` and never closes the returned `File`. `cleanup_file` calls `@file.close` then `File.unlink(@file.path)` — but `@file` may be a `File` object the caller is still streaming (in `ExportsExpo#download`, `export.open` returns the shrine IO, not this file, so this particular leak is bounded, but the pattern is fragile). `cleanup_dir` uses `FileUtils.rm_rf(@directory)` but never removes the `.zip` sibling created by `zip_directory`.

**Recommendation.** Use `File.open(...) { |f| ... }` block form; in `cleanup_dir`, also unlink `"#{@directory}.zip"`.

**Effort:** S.

---

### SYNC-013 — Medium / CodeSmell — Unvalidated `IDAH_URL`

**File:** `app/service/exports/upd/exporter.rb:93-97`

**Description.** `URI.join(ENV.fetch("IDAH_URL"), "api/v1/media/medias/files/#{entry.record.resource}")` — if `IDAH_URL` is unset, `ENV.fetch` raises at request time (good), but if it is set to a malformed value the join silently produces a broken URL. `entry.record.resource` is interpolated unencoded into the path.

**Recommendation.** Validate `IDAH_URL` at boot (must be a valid absolute `http(s)` URI) and `CGI.escape` the resource segment.

**Effort:** S.

---

### SYNC-014 — Medium / Architecture — Fragile export lookup in job

**File:** `app/service/exports/job.rb:29`

**Description.**
```ruby
export = exports.index({ job_id: }, items_per_page: 1).first
exports.upload(export.id, import_file)
```
The job assumes the *first* export by DB order is the one it should upload to. If multiple exports share a `job_id` (the schema allows it — `exports.job_id` is not unique), or if rows are returned in an unexpected order, the upload lands on the wrong export. The export ID is already known at creation time (`Exports::Service#create` creates the export row right next to the job) and should be passed in `arguments`.

**Recommendation.** Store `export_id` in the job arguments and look it up directly.

**Effort:** S.

---

### SYNC-015 — Medium / Security — `constantize` of `job.job_class` only checks subclass

**File:** `app/service/jobs/scheduler.rb:80-86`

**Description.**
```ruby
klass = Verse::Util::Reflection.constantize(job.job_class)
unless klass < Jobs::Base
  raise "Job class #{job.job_class} is not a valid Jobs::Base subclass"
end
```
This guards against arbitrary constants, which is good, but `job_class` is a free-text column populated by `Exports::Service#create` from `arguments[:exporter]`, which is only validated against `Exports::Registry.valid_export_class?` (a string match). The check is "is this string in the registry", not "is this the class we expect for this argument shape". Any registered exporter class is instantiated with `klass.new.export(export_context)`, and `export_class` is also re-`constantize`d inside `Exports::Job#run_impl` (`exporter.rb` line 15 of `job.rb`) — so the registry check is the only gate. If the registry ever accepts a wildcard (it does: `default_export_formats.rb` registers `/.*/`), the gate is effectively open.

**Recommendation.** Resolve the class through the registry (return the class object, not the string) rather than re-`constantize`-ing a user-supplied string in two places.

**Effort:** S.

---

### SYNC-016 — Medium / CodeSmell — Float exponent in retry backoff

**File:** `app/service/jobs/scheduler.rb:113-115`

**Description.**
```ruby
retry_delay = 5 * (2 ** (job.retry_count * 1.5)).to_i
```
`job.retry_count * 1.5` is a float; `2 ** 1.5` works but the `.to_i` truncates *after* the power, so for `retry_count=1` → `2 ** 1.5 = 2.828 → 2 → 10s`, `retry_count=2` → `2 ** 3 = 8 → 40s`. The intent is unclear and the math is surprising. Also `klass.max_retries` defaults to `0` (`Jobs::Base`), so retries never actually happen for `Exports::Job` today.

**Recommendation.** Use integer math (`5 * (1 << job.retry_count)`) and set `max_retries` explicitly on `Exports::Job`.

**Effort:** S.

---

### SYNC-017 — Medium / Performance — Cross-service call inside `scoped` on every query

**File:** `app/model/exports.rb:44-47, 63-66`, `app/model/jobs.rb:124-127, 145-148`

**Description.** Both repositories call `Api[:idah].dataset.projects.index_all(...)` / `project_members.index_all(...)` from inside `scoped`, which runs on **every** `index`/`show`/`count`. There is no caching, no batching, and no failure mode handling — if the Dataset service is down, every sync query fails.

**Impact.** Latency multiplier on every export/job read; hard dependency on Dataset availability for read paths.

**Recommendation.** Resolve project membership once per request in the service layer and pass an explicit `project_ids` filter down, or cache via the auth context.

**Effort:** M.

---

### SYNC-018 — Medium / CodeSmell — Destructive mutation of annotation dimensions

**File:** `app/service/exports/upd/exporter.rb:128-129`

**Description.**
```ruby
dimensions = annotation.record.dimensions
type = dimensions.delete(:type)
```
`dimensions` is the record's own attribute hash; `delete(:type)` mutates it in place. If the same record is exported twice in the same process (e.g. two jobs sharing cached API responses) the second export sees a `dimensions` hash without `:type`.

**Recommendation.** `dimensions = annotation.record.dimensions.dup` before deleting.

**Effort:** S.

---

### SYNC-019 — Low / CodeSmell — `in` pattern used as a boolean expression

**File:** `app/service/exports/registry.rb:14, 19`

**Description.** `modalities = [modalities] unless modalities in Array` and `unless modality in String | Regexp` rely on Ruby 3.0+ rightward pattern match. It works but is unusual and easy to misread; a `case/when` would be clearer.

**Effort:** S.

---

### SYNC-020 — Low / CodeSmell — `Executor` with safe escaping is unused

**File:** `app/util/executor.rb`

**Description.** The service ships a perfectly good `Executor` (with `Shellwords.escape`, `Open3.popen3`, async `Promise`, and a thread pool) and instantiates it globally as `EXECUTOR` in `config/initializers/scheduler.rb:5`. Nothing in the codebase calls it — the UPD exporter uses raw `system()` instead (SYNC-001). Either delete `Executor` or migrate the exporter to use it.

**Effort:** S.

---

### SYNC-021 — Low / Architecture — `formats` endpoint discards scope result

**File:** `app/expo/exports_expo.rb:71-77`

**Description.**
```ruby
auth_context.can!(:read, Resource::Sync::Exports) do |scope|
  formats = Exports::Registry.list_export_format_details(params[:modalities])
  scope.all? { formats }
  scope.as_org_owner? { formats }
  scope.as_user? { formats }
end
```
The block returns the value of the last `scope.*` branch evaluated; the intermediate assignments are dead. The auth check is really just "can the caller read exports at all", which is fine, but the structure implies per-scope filtering that doesn't happen.

**Recommendation.** Simplify to a single `auth_context.can!(:read, Resource::Sync::Exports)` call and return `formats` directly.

**Effort:** S.

---

### SYNC-022 — Low / CodeSmell — Reaching into `exports.table.db.after_rollback`

**File:** `app/service/exports/service.rb:71-76`

**Description.** `exports.table.db.after_rollback { ... storage.delete(file.id) ... }` reaches through the repository into the Sequel `Database` object to register a rollback hook. This couples the service layer to Sequel internals and assumes the repository exposes `table` (a Verse::Sequel implementation detail).

**Recommendation.** Expose a `repository.on_rollback { ... }` helper on the repository base, or perform the storage cleanup in a higher-level coordination layer.

**Effort:** M.

---

### SYNC-023 — Low / CodeSmell — Stray `puts` at boot

**File:** `config/initializers/scheduler.rb:12`

**Description.** `puts ENV["PUMA_WORKERS"]` writes to stdout on every boot. Should be a `Verse.logger&.debug` or removed.

**Effort:** S.

---

### SYNC-024 — Info / Architecture — `use_system jobs: Jobs::Service`

**File:** `app/service/exports/service.rb:6`

**Description.** `Exports::Service` declares `use_system jobs: Jobs::Service`, which bypasses auth scoping for job creation. This is acceptable because the service has already validated the user's rights over the datasets (`filter_dataset_ids_by_rights`) before creating the job, but it is exactly the pattern the project's golden rule #2 warns about. Worth a comment explaining why.

**Effort:** S.

---

### SYNC-025 — Info / CodeSmell — Inconsistent primary key types

**File:** `db/migrations/20251114000000_create_initial_schema.rb:39, 64-65`, `app/model/exports.rb:7`, `app/model/jobs.rb:7`

**Description.** `jobs.id` is `:uuid` (default `uuid_generate_v7()`), `exports.id` is `:bigserial`. Both records declare `field :id, type: String`. The `exports.id` is therefore a serialized integer in JSON:API responses while `jobs.id` is a UUID — inconsistent API surface and prevents using `UUIDv7.generate` consistently per golden rule #10.

**Recommendation.** Consider making `exports.id` a UUID v7 for consistency.

**Effort:** M (migration required).

---

*End of audit. No code was modified.*
