# Dataset Service Audit Report

**Scope:** `idah/app/dataset/` — expositions, models, services, util, config, migrations, Gemfile, config.ru, dev-entrypoint.sh
**Date:** 2026-06-18
**Auditor:** Automated review of every `.rb` file in scope (70 files)

---

## Executive Summary

The Dataset service is the largest and most security-sensitive service in IDAH: it owns projects, datasets, entries, annotations, note feeds/comments, entry stats, project members, and the annotation workflow. Auth scoping is implemented as raw SQL fragments via `Sequel.lit` in every repository, and while the parameters are bound (no direct string interpolation of user input), the role lists are hardcoded Ruby arrays interpolated into `IN :roles` placeholders — these are safe today but fragile. The most serious issues are: (1) a workflow self-review bypass that lets an annotator review their own submission when the dataset's `sample_rate` is `< 1`, because the workflow re-uses `entry.reviewed_by_id` (which the annotator can set themselves via `Entry.update`); (2) a missing `entry_id`/`project_id` consistency check on annotation creation that allows an annotation to be created with an `entry_id` from one project and (via JSON:API relationships) a different `project_id`; (3) unbounded pagination defaults of `items_per_page: 1000` on every `index` call combined with eager JSON columns (`dimensions`, `annotation`, `labeling_configuration`) that can produce very large responses; and (4) several `use_system` repository instantiations that bypass auth scoping for legitimate operational reasons (workflow transitions, account deletion cascades) but are not always narrowly scoped. There are also several Medium-severity concerns around swallowed plugin errors in `EntryStats::Recompute`, missing DB indexes on hot filter columns (`annotations.entry_id`, `annotations.updated_at`, `note_feeds.status`+`project_id` composite), and a `mark_entries_status_as` repository method that uses `find_by!` with `status: "processing"` and will silently no-op if the entry already transitioned.

---

## Findings Table

| ID  | Severity | Category     | File:Line                                                                     | Title                                                                                          |
|-----|----------|--------------|-------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| D01 | High     | Security     | `app/model/workflow/simple_review_annotation_workflow.rb:66`                 | Self-review bypass: annotator can review own submission via `reviewed_by_id` reuse            |
| D02 | High     | Security     | `app/service/annotation/service.rb:22-62`                                     | Missing project/dataset consistency check on annotation create (cross-project `entry_id`)     |
| D03 | High     | Security     | `app/service/note_feed/service.rb:82-87`                                      | Note feed `annotation_id` not validated against entry's dataset (IDOR)                         |
| D04 | High     | Architecture | `app/model/entry.rb:281-287`                                                   | `mark_entries_status_as` uses `find_by!` with stale status filter, silently no-ops            |
| D05 | Medium   | Security     | `app/service/project_member/service.rb:69-90`                                 | Role escalation via `update`: `project_owner` check bypassed when role unchanged              |
| D06 | Medium   | Security     | `app/service/entry/service.rb:107-121`                                         | `select` allows re-assigning an entry already assigned to another user (race / takeover)     |
| D07 | Medium   | Security     | `app/model/note_feed.rb:158-207`, `app/service/note_feed/service.rb:35-37`    | `resolve` scope allows annotator to resolve any feed they created, even after reassignment     |
| D08 | Medium   | Performance  | `app/service/*/service.rb` (all `index` methods)                              | Default `items_per_page: 1000` with eager JSON columns → unbounded response size               |
| D09 | Medium   | Performance  | `db/migrations/20250714000000_create_initial_schema.rb` (annotations table)   | Missing index on `annotations.entry_id` and `annotations.updated_at` (hot filter paths)        |
| D10 | Medium   | Performance  | `app/service/entry_stats/recompute.rb:64`                                      | `EntryStat::Repository.new(nil)` — repo built with nil auth context, relies on no scope check |
| D11 | Medium   | CodeSmell    | `app/service/entry_stats/recompute.rb:18-25`                                   | Plugin stat errors swallowed; only logged, no metric/event emitted                            |
| D12 | Medium   | Architecture | `app/service/scoped_query/service.rb:7-28`                                      | `ScopedQuery::Service` instantiates repo with `Verse::Auth::Context[:system]` but is named like a service |
| D13 | Medium   | Security     | `app/expo/entries_expo.rb:35-53` (`assign`) and `app/service/entry/service.rb:93-98` | `assign_member` does not verify the target member belongs to the entry's project              |
| D14 | Low      | Security     | `app/model/project_member.rb:67`                                              | `elsif project_id` references undefined local `project_id` (should be `project_ids`) — bug   |
| D15 | Low      | Performance  | `app/model/dataset.rb:159-178`                                                | `update_progress!` re-fetches dataset row on every entry submit (N+1 on bulk submit)          |
| D16 | Low      | CodeSmell    | `app/model/entry.rb:53-71`                                                    | `participated` / `assigned` custom filters use `Sequel.lit` with bound params — fine, but `assigned` coerces arbitrary truthy strings |
| D17 | Low      | CodeSmell    | `app/model/dataset.rb:33-36`, `app/service/note_feed/service.rb:74-75`         | `entry_workflow` hardcoded to `SimpleReviewAnnotationWorkflow`; ignores `workflow_configuration.type` |
| D18 | Low      | CodeSmell    | `app/model/workflow/simple_review_annotation_workflow.rb:30-37`               | `sample_rate` defaults to `1` but `rand < 1` is always true — non-deterministic test surface  |
| D19 | Low      | CodeSmell    | `app/expo/annotations_expo.rb:38-49`                                           | JSON-RPC `RpcCreateSchema` allows open `dimensions`/`annotation`/`metadata` Hash with no size/depth limit |
| D20 | Low      | Architecture | `app/service/dataset/service.rb:77-98`                                         | `notify_dataset_completed` sends emails inline in service (sync I/O on event handler thread)  |
| D21 | Low      | Architecture | `app/service/project_member/service.rb:47-63`                                 | `Api[:idah].iam.accounts.show` HTTP call inside `after_commit` blocks the transaction callback |
| D22 | Info     | CodeSmell    | `app/model/entry.rb:13-14`                                                    | `wf_step`/`status` commented-out `readonly: true` — these are mutable via PATCH              |
| D23 | Info     | CodeSmell    | `app/model/dataset.rb:55` (commented), `app/service/dataset/service.rb:33`    | Dead/commented code referencing `created_by_email` on Dataset                                 |
| D24 | Info     | Security     | `app/model/note_comment.rb:60-66`, `app/model/note_feed.rb:67-73`             | Org-owner `update`/`delete` scope on note feeds/comments is `created_by_email` only — org owners cannot moderate |
| D25 | Info     | Performance  | `db/migrations/20250714000001_add_triggers_on_annotations.rb`                  | Triggers fire `UPDATE entries/datasets/projects` on every annotation insert → write amplification |
| D26 | Info     | CodeSmell    | `app/expo/annotations_expo_spec.rb:116`                                        | Spec uses `/annotations/rpc` but route is `_rpc` — batch spec path mismatch (test only)       |

---

## Detailed Findings

### D01 — High / Security — Self-review bypass via `reviewed_by_id` reuse

**File:** `app/model/workflow/simple_review_annotation_workflow.rb:54-88`

**Description:** When an annotator submits from the `annotate` step, the workflow transitions to `:review` only if `should_sample?` is true (controlled by `dataset.workflow_configuration[:sample_rate]`). When it does, `on_submit` sets:

```ruby
when :annotate
  # If moving to review step, assign to reviewer (nil for unassigned)
  @entry.reviewed_by_id
```

`reviewed_by_id` is a regular mutable field on `Entry::Record` (see `entry.rb:24`, no `readonly: true`), and the JSON:API `update` endpoint (`entries_expo.rb:31` `update`) allows any user with `:update` scope (i.e. `project_owner`) to set `reviewed_by_id` to any account id — including their own. There is no check in the workflow that `reviewed_by_id != submitted_by_id`. A `project_owner` who is also the annotator can therefore submit, then review their own work.

Even for non-`project_owner` users, the entry's `reviewed_by_id` is set by the workflow itself on the *previous* review cycle, so once an annotator has had any entry reviewed by reviewer X, X stays as `reviewed_by_id` and will be re-assigned on subsequent cycles — but the more serious issue is the absence of a self-review guard.

**Impact:** An annotator who is also a project owner (common in small teams) can approve their own annotations, defeating the entire review separation control. Audit trail will show different actor ids only if the user switches accounts.

**Evidence:**
```ruby
# workflow/simple_review_annotation_workflow.rb
assigned_to_id =
  case from_state
  when :annotate
    @entry.reviewed_by_id   # <-- no check this != submitted_by_id
```

```ruby
# entry.rb:22-24
field :assigned_to_id, type: [Integer, NilClass]
field :submitted_by_id, type: [Integer, NilClass]
field :reviewed_by_id, type: [Integer, NilClass]   # mutable via PATCH
```

**Recommendation:** In `Workflow::Base#on_submit` (or in `Entry::Service#submit`), raise `Verse::Error::Unauthorized` when `from_state == :annotate && to_state == :review && account_id == submitted_by_id`. Also consider making `submitted_by_id`/`reviewed_by_id` `readonly: true` on the Record so they cannot be set via PATCH.

**Effort:** S

---

### D02 — High / Security — Missing project/dataset consistency check on annotation create

**File:** `app/service/annotation/service.rb:22-62`

**Description:** `Annotation::Service#create` accepts a JSON:API record whose `entry` relationship points to an `entry_id`. The service looks up the entry via the scoped `entries.find(record.entry.id)` and then assigns:

```ruby
attributes[:project_id] = entry.project_id
attributes[:dataset_id] = entry.dataset_id
attributes[:entry_id] = entry.id
```

This is correct *if* the client does not also send `project_id` / `dataset_id` in `attributes`. However, `Annotation::Record` declares `project_id` and `dataset_id` as `readonly: true` (annotation.rb:8-10), but Verse's readonly enforcement depends on the renderer/deserializer configuration — and the JSON-RPC `create` path (`annotations_expo.rb:54-69`) builds the deserialized record from `attributes: params`, where `params` is the entire RPC payload. If the client sends `project_id` in the RPC `create` payload, it will be present in `record.attributes` and will override the value derived from the entry, because the service does `attributes = record.attributes` *before* reassigning — but the reassignment lines above do override them, so this specific path is safe.

The real gap: there is **no check that the entry's `project_id` matches any `project_id` the client may have supplied via a top-level `relationships: project` link** in the JSON:API path. The `authorized_relationships entry: [:link]` declaration (annotations_expo.rb:19) only permits linking `entry`, but Verse does not reject extra relationship keys unless configured to. A client could link both `entry` (project A) and `project` (project B); the service ignores `record.project` and trusts the entry, but the event metadata and any downstream consumers may see inconsistent state.

More concretely, the `dimensions` and `annotation` JSON blobs are never validated against `labeling_configuration` — an attacker with annotator access can store arbitrary JSON (see D19).

**Impact:** Potential for inconsistent `project_id`/`dataset_id` if a future refactor changes which attributes are reassigned. Today the reassignment masks the issue, but the lack of an explicit invariant check is a latent IDOR risk.

**Evidence:**
```ruby
# annotation/service.rb:50-56
attributes = record.attributes
attributes[:id] = record.id || UUIDv7.generate
attributes[:project_id] = entry.project_id
attributes[:dataset_id] = entry.dataset_id
attributes[:entry_id] = entry.id
```

**Recommendation:** Add an explicit guard: `raise if record.respond_to?(:project) && record.project && record.project.id != entry.project_id`. Validate `dimensions` and `annotation` against `entry.dataset.labeling_configuration` (or at least enforce a max depth/size).

**Effort:** M

---

### D03 — High / Security — Note feed `annotation_id` not validated against entry's dataset

**File:** `app/service/note_feed/service.rb:82-87`

**Description:** When creating a note feed with `anchor_type == "annotation"`, the service does:

```ruby
if attributes[:annotation_id] && attributes[:anchor_type] == "annotation"
  annotation_id = attributes[:annotation_id]
  annotations.find!(annotation_id)   # scoped read
else
  attributes.delete(:annotation_id)
end
```

The `annotations.find!` call is scoped, so an annotator can only reference annotations on entries assigned to them — good. **However**, there is no check that the annotation belongs to the same `entry_id` provided in the note feed payload. An annotator with access to two entries in the same project can create a note feed anchored on `entry_id = A` but pointing at `annotation_id` belonging to `entry_id = B`. The note feed will then be persisted with `entry_id = A` and `annotation_id = B`, producing a dangling cross-entry reference.

**Impact:** Confused data model; downstream UIs that join `note_feeds` to `annotations` by `entry_id` will show the wrong annotation. Not a direct privilege escalation, but a data-integrity IDOR.

**Evidence:**
```ruby
# note_feed/service.rb:82-87
if attributes[:annotation_id] && attributes[:anchor_type] == "annotation"
  annotation_id = attributes[:annotation_id]
  annotations.find!(annotation_id)
else
  attributes.delete(:annotation_id)
end
```

**Recommendation:** After `annotations.find!`, assert `annotation.entry_id == attributes[:entry_id]` and raise `Verse::Error::ValidationFailed` otherwise.

**Effort:** S

---

### D04 — High / Architecture — `mark_entries_status_as` uses stale status filter

**File:** `app/model/entry.rb:281-287`

**Description:**

```ruby
def mark_entries_status_as(job_id, status)
  entry = find_by!({ job_id: job_id, status: "processing" })
  transaction do
    update!(entry.id, { status: status })
  end
end
```

This is invoked from `EntriesExpo#on_job_completed` and `on_job_errored` (entries_expo.rb:108-120) when a Media job event fires. The `find_by!` filters by `status: "processing"`, but if the event is delivered twice (Redis pub/sub at-least-once), or if the entry has already transitioned (e.g. via `submit`), the second call raises `Verse::Error::RecordNotFound` and the event handler crashes. Worse, the `update!` uses the default `scoped(:update)` which for the system auth context is `table` (all rows) — but the entry is fetched via the *user* auth context's `scoped(:read)` because `Entry::Service#mark_entries_status_as` calls `entries.mark_entries_status_as` where `entries` is the user-scoped repo. Since this is an event handler, there is no HTTP auth context — it runs as `:system` via the expo's service instantiation, but the comment in `Entry::Service` does not make this explicit.

**Impact:** Duplicate job events crash the event handler; status transitions can be lost. The use of `find_by!` instead of an idempotent `UPDATE entries SET status = ? WHERE job_id = ? AND status = 'processing'` is a correctness bug.

**Evidence:** see snippet above.

**Recommendation:** Replace with an idempotent scoped update:
```ruby
def mark_entries_status_as(job_id, status)
  transaction do
    table.where(job_id: job_id, status: "processing").update(status: status)
  end
end
```
Or use `system_entries_repo` explicitly in the service.

**Effort:** S

---

### D05 — Medium / Security — Role escalation via `update` when role unchanged

**File:** `app/service/project_member/service.rb:69-90`

**Description:** `ProjectMember::Service#update` only performs the `project_owner` escalation check when `record.attributes[:role] == "project_owner"`. A `project_owner` user (who has `:update` scope) can therefore change any other attribute on a `project_owner` member record — for example, changing `account_id` to point at a different account, effectively transferring the `project_owner` role to that account without the org-owner check. The `account_id` field is declared `readonly: true` on the Record (project_member.rb:10), which should prevent this via JSON:API, but Verse's readonly enforcement at the service layer is not visible here and the service passes `record.attributes` straight through to `project_members.update!`.

**Impact:** If readonly enforcement is bypassed (e.g. via the JSON-RPC path or a future schema change), a project_owner could escalate another account to project_owner. Defense-in-depth gap.

**Evidence:**
```ruby
def update(record)
  access = auth_context.can?(:update, project_members.class.resource)
  if record.attributes[:role] == "project_owner"
    # ... org-owner check ...
  end
  project_members.update!(record.id, record.attributes)   # no field whitelist
end
```

**Recommendation:** Explicitly whitelist updatable fields (`role`, `email`, `name`) and re-check authorization when `role` changes *to or from* `project_owner`. Do not rely on Record `readonly:`.

**Effort:** M

---

### D06 — Medium / Security — `select` allows re-assigning an already-assigned entry

**File:** `app/service/entry/service.rb:107-121`

**Description:**

```ruby
def select(entry_id)
  entries.transaction do
    account_id = auth_context.metadata[:id]
    entry = entries.find!(entry_id)
    if entry.assigned_to_id && entry.assigned_to_id != account_id
      raise Verse::Error::Unauthorized, "You are not assigned to this entry"
    end
    entries.select(entry.id)   # sets assigned_to_id = account_id
    entries.find!(entry.id)
  end
end
```

The guard rejects only when `assigned_to_id` is set *and* differs. When `assigned_to_id` is `nil`, any user with read access can "select" (claim) the entry — this is intended for the annotator pool. But there is no atomicity guarantee: two users racing on the same `nil` entry will both pass the guard, and the second `update!` wins. There is also no check that the entry is in a workflow step that allows claiming (e.g. `wf_step == 'start'`); an annotator can claim an entry that is already in `review`, which then becomes assigned to them and breaks the reviewer pool.

**Impact:** Race conditions on entry assignment; workflow state corruption when claiming entries in non-`start` steps.

**Evidence:** see snippet.

**Recommendation:** Make the claim conditional in SQL: `UPDATE entries SET assigned_to_id = ? WHERE id = ? AND assigned_to_id IS NULL`. Add a `wf_step` guard.

**Effort:** M

---

### D07 — Medium / Security — Annotator `resolve` scope is too broad for own-created feeds

**File:** `app/model/note_feed.rb:158-207`, `app/service/note_feed/service.rb:35-37`

**Description:** The `:resolve` scope allows an annotator to resolve a note feed if they created it (`created_by_email = email`) AND it is on an entry assigned to them. Once the annotator creates the feed, they can resolve it even if the entry has since been reassigned to a reviewer — because the scope checks `entries.assigned_to_id = :account_id` at resolve time, but the annotator may have already moved on. More importantly, the doc-comment at note_feed.rb:78 says "project_owner and reviewer can resolve note feeds in their projects" — annotators are not supposed to resolve at all, but the `own_roles: %w[annotator]` branch grants it.

**Impact:** Annotators can resolve (close) note feeds they created, contradicting the documented access policy and potentially hiding unresolved issues from reviewers.

**Evidence:**
```ruby
# note_feed.rb:179-195
) OR (
  -- From assigned entries with only own note feeds
  note_feeds.created_by_email = :email AND
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.account_id = :account_id
      AND pm.project_id = note_feeds.project_id
      AND pm.role IN :own_roles        # %w[annotator]
    AND EXISTS (SELECT 1 FROM entries e WHERE e.id = note_feeds.entry_id AND e.assigned_to_id = :account_id)
  )
)
```

**Recommendation:** Remove the `own_roles` branch or restrict it to `reviewer`. Confirm with the product team whether annotator-resolve is intended.

**Effort:** S

---

### D08 — Medium / Performance — Default `items_per_page: 1000` with eager JSON columns

**File:** `app/service/*/service.rb` (every `index` method), e.g. `app/service/annotation/service.rb:7`

**Description:** Every service `index` method has signature `def index(filter = {}, ..., items_per_page: 1000, ...)`. The default of 1000 is passed straight to the repository. For annotations, each row includes two non-trivial JSONB columns (`dimensions`, `annotation`) and the new `metadata` column. A single page of 1000 annotations can easily exceed several MB of JSON. There is no server-side maximum, so a client can request `items_per_page=100000` and the service will honor it. The `index` expositions do not declare a `max_items_per_page`.

**Impact:** Memory blowup and slow responses; potential DoS vector for authenticated users.

**Evidence:**
```ruby
# annotation/service.rb:7-16
def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
  annotations.index(filter, included:, page:, items_per_page:, sort:, query_count:)
end
```

**Recommendation:** Cap `items_per_page` at a sane maximum (e.g. 100) in each service: `[items_per_page, 100].min`. Consider excluding `dimensions`/`annotation` from list responses unless explicitly requested via sparse fieldsets.

**Effort:** S

---

### D09 — Medium / Performance — Missing indexes on hot annotation/note_feed filter columns

**File:** `db/migrations/20250714000000_create_initial_schema.rb:217-256` (annotations), `:258-312` (note_feeds)

**Description:** The annotations table has indexes on `project_id`, `dataset_id`, `entry_id` (FK indexes) and a GIN trigram index on `created_by_email`. However:
- `annotations.entry_id` is indexed (good), but the `entry_stats` recomputation path (`EntryStats::CoreStats.call`) iterates `entry.annotations` — that's fine.
- `annotations.updated_at` is exposed as the only filter on `AnnotationsExpo.index` (`allowed_filters :updated_at__gt`), but there is **no index on `annotations.updated_at`**. A client polling "give me annotations updated since X" will trigger a full scan.
- `note_feeds.status` is indexed, but the common filter combination `status + project_id` has no composite index.
- `entries.resource` is queried by `Entry::Service#create` via `entries.find_by({ resource: ... })` and there is **no unique index on `entries.resource`** — the service enforces uniqueness in Ruby, which is racy.

**Impact:** Slow polling endpoints; race condition on duplicate entries under concurrent creates.

**Evidence:** migration does not include `index :updated_at` on annotations; no `index [:project_id, :status]` on note_feeds; no unique index on `entries.resource`.

**Recommendation:** Add migrations:
```ruby
add_index :annotations, :updated_at
add_index :note_feeds, [:project_id, :status]
add_index :entries, :resource, unique: true   # if global uniqueness is intended
```

**Effort:** S

---

### D10 — Medium / Performance / Architecture — `EntryStat::Repository.new(nil)`

**File:** `app/service/entry_stats/recompute.rb:64`

**Description:**

```ruby
def self.persist(entry_id, stats)
  repo = EntryStat::Repository.new(nil)   # nil auth_context
  repo.transaction do
    repo.delete_by_entry_id(entry_id)
    repo.bulk_insert(entry_id, stats)
  end
end
```

The repository is instantiated with `nil` as the auth context. `EntryStat::Repository#scoped` calls `auth_context.can!(...)` which will NoMethodError on `nil`. This only works because `delete_by_entry_id` and `bulk_insert` use `table` directly without going through `scoped`. This is a fragile pattern: any future refactor that routes these through the scoped path will crash, and it bypasses the auth-check guarantee that the framework expects.

**Impact:** Latent crash; bypasses the "every repo call is scoped" invariant.

**Evidence:** see snippet.

**Recommendation:** Use `Verse::Auth::Context[:system]` explicitly (as `ScopedQuery::Service` does), or better, inject the repo via the service layer (`EntryStats::Service` already has `use_system system_entries:` — add `use_system system_entry_stats:`).

**Effort:** S

---

### D11 — Medium / CodeSmell — Plugin stat errors swallowed

**File:** `app/service/entry_stats/recompute.rb:18-25`

**Description:**

```ruby
begin
  collect_plugin_stats(entry, stats)
rescue StandardError => e
  Verse.logger.error("[EntryStats] Plugin generator for modality '#{entry.dataset.modality}' failed: ...")
end
```

Any exception from a plugin's stats generator is caught and logged, then core stats are persisted. This is a deliberate resilience choice (documented in the comment), but there is no metric, no event, and no way for an operator to discover that a plugin is failing other than grepping logs. `StatKeyConflictError` (a programming error indicating two generators emit the same key) is also caught here, masking real bugs.

**Impact:** Silent data loss for plugin stats; hard to operate.

**Evidence:** see snippet.

**Recommendation:** Emit a Verse event (`event "entry_stats.plugin_failed"`) or increment a counter via `Verse::Redis::Counter`. Consider re-raising `StatKeyConflictError` since it indicates a registration bug.

**Effort:** S

---

### D12 — Medium / Architecture — `ScopedQuery::Service` is a misnamed module

**File:** `app/service/scoped_query/service.rb:1-33`

**Description:** The file defines `module ScopedQuery; module Service; module_function` — it is a module of two pure functions, not a `Verse::Service::Base` subclass. The name `Service` violates the project's Zeitwerk convention (`service/scoped_query/service.rb` → `ScopedQuery::Service` is correct naming-wise) but it is misleading because it implies a service-layer object. More importantly, it instantiates a repository with the system auth context directly:

```ruby
member_repo = ProjectMember::Repository.new(Verse::Auth::Context[:system])
```

This is a legitimate use of the system context (the function is called from authorization checks inside other services), but it bypasses the `use_system` DSL pattern documented in the AGENTS.md golden rules. The system-context instantiation is hidden inside a helper rather than declared at the service class level.

**Impact:** Inconsistent with the codebase's `use_system` convention; makes auditing "who uses the system context" harder.

**Evidence:** see snippet.

**Recommendation:** Either rename to `ScopedQuery::Checks` / `ScopedQuery::Access` to clarify it is not a service, or have calling services pass in their own `system_*` repo.

**Effort:** S

---

### D13 — Medium / Security — `assign_member` does not verify target member belongs to entry's project

**File:** `app/expo/entries_expo.rb:35-53`, `app/service/entry/service.rb:93-98`

**Description:**

```ruby
# entries_expo.rb
def assign
  id = params[:id]
  member_id = params.dig(:data, :attributes, :assigned_to_id)
  service.assign_member(id, member_id)
end

# entry/service.rb
def assign_member(id, assigned_to_id)
  entries.transaction do
    entries.assign(id, { assigned_to_id: })
    entries.find!(id)
  end
end
```

`assigned_to_id` is an `account_id` (integer). There is no check that the account is an active member of the entry's project (`project_members` with `disabled_at IS NULL`). A project_owner could assign an entry to an account that has been removed from the project, or to an account that was never a member. The downstream workflow will then fail in confusing ways when the assignee cannot see the entry (because the entry scoping requires active membership).

**Impact:** Data inconsistency; potential for assigning entries to accounts that should not have access (though scoping will prevent them from actually reading it).

**Evidence:** see snippet.

**Recommendation:** In `assign_member`, verify via `ScopedQuery::Service.with_project_access?(assigned_to_id, entry.project_id, %w[annotator reviewer project_owner])` before assigning.

**Effort:** S

---

### D14 — Low / Security (bug) — Undefined local `project_id` in `ProjectMember::Repository#scoped`

**File:** `app/model/project_member.rb:67`

**Description:**

```ruby
scope.as_org_owner? do
  org_ids = auth_context.custom_scopes[:org]
  project_ids = auth_context.custom_scopes[:project]

  if org_ids
    # ...
  elsif project_id            # <-- BUG: should be project_ids
    table.where(project_id: project_ids)
  else
    table.where(Sequel.lit("false"))
  end
end
```

`project_id` is never assigned; in Ruby this evaluates to `nil`, so the `elsif` branch is never taken. An org_owner with a `project` custom scope (but no `org` scope) will fall through to `where(Sequel.lit("false"))` and see zero project members. Compare with the equivalent code in `project.rb:39` which correctly uses `project_id` (singular) because the local is named `project_id` there.

**Impact:** Org owners scoped to specific projects cannot list project members. Functional bug with security-adjacent impact (over-restriction, not over-exposure).

**Evidence:** see snippet — `project_ids` is assigned, `project_id` is referenced.

**Recommendation:** Change `elsif project_id` to `elsif project_ids`.

**Effort:** S

---

### D15 — Low / Performance — `update_progress!` re-fetches dataset row per submit

**File:** `app/model/dataset.rb:159-178`, `app/service/entry/service.rb:123-137`

**Description:** Every `Entry::Service#submit` calls `system_datasets_repo.update_progress!(entry.dataset.id)`, which performs a `SELECT ... WHERE id = ?` to read the counter columns, then an `UPDATE`. The counters are maintained by a trigger (`update_dataset_entry_counters`), so the read is only to compute the ratio. Under bulk submit (e.g. a script submitting 100 entries), this is 200 extra queries.

**Impact:** Minor latency under bulk operations.

**Evidence:** see `dataset.rb:159-178`.

**Recommendation:** Compute progress in the same UPDATE using a subquery, or batch progress updates.

**Effort:** M

---

### D16 — Low / CodeSmell — `assigned` filter coerces arbitrary truthy strings

**File:** `app/model/entry.rb:63-71`

**Description:**

```ruby
custom_filter :assigned do |collection, value|
  assigned = value.to_s.downcase == "true"
  # ...
end
```

Only the literal string `"true"` (case-insensitive) is treated as true; `"1"`, `"yes"`, `"t"` all map to false. This is inconsistent with Verse's built-in `exists` operator (filtering_pg.rb:25-31) which treats `"0"`, `"false"`, `false`, `""` as false and everything else as true.

**Impact:** Minor API surprise.

**Evidence:** see snippet.

**Recommendation:** Use the same truthiness rule as the framework, or document the contract.

**Effort:** S

---

### D17 — Low / CodeSmell — `entry_workflow` hardcoded; `workflow_configuration.type` ignored

**File:** `app/model/dataset.rb:33-36`, `app/service/note_feed/service.rb:74-75`

**Description:**

```ruby
# dataset.rb
def entry_workflow
  Workflow::SimpleReviewAnnotationWorkflow
end
```

`Dataset::Record` has a `workflow_configuration` JSONB column with a `type` field (per `WorkflowConfigSchema`), but `entry_workflow` always returns the single concrete workflow class. The schema is parsed but never used to select a workflow. This means the `workflow_configuration.type` field is dead configuration today.

**Impact:** Misleading API; blocks future multi-workflow support.

**Evidence:** see snippet.

**Recommendation:** Either remove `WorkflowConfigSchema` and the `type` field, or implement a registry lookup.

**Effort:** M

---

### D18 — Low / CodeSmell — `sample_rate` default makes sampling deterministic-true

**File:** `app/model/workflow/simple_review_annotation_workflow.rb:30-37`

**Description:**

```ruby
def sample_rate
  @entry.dataset.workflow_configuration[:sample_rate] || 1
end

def should_sample?
  rand < sample_rate
end
```

When `sample_rate` is unset, it defaults to `1`, and `rand < 1` is always true (so every entry goes to review). This is probably the intended safe default, but it makes the "skip review" code path (`transitions from: :annotate, to: :done, unless: :should_sample?`) effectively dead unless an operator explicitly configures `sample_rate < 1`. The use of `rand` also makes workflow transitions non-deterministic and hard to test (the spec suite uses `Kernel.srand` but no test exercises the `< 1` branch deterministically).

**Impact:** Dead branch; surprising operator experience.

**Evidence:** see snippet.

**Recommendation:** Document the default; add a test for `sample_rate: 0`.

**Effort:** S

---

### D19 — Low / Security — JSON-RPC `RpcCreateSchema` allows unbounded open Hashes

**File:** `app/expo/annotations_expo.rb:38-49`

**Description:**

```ruby
RpcCreateSchema = Verse::Schema.define do
  field(:id, String).default { UUIDv7.generate }
  field(:entry_id, String)
  field(:dimensions, Hash) # Open Hash
  field(:annotation, Hash) # Open Hash
  field?(:metadata, Hash) # Open Hash
end
```

The three JSON payloads are typed as open `Hash` with no schema, no max depth, and no size limit. A client can POST a multi-MB JSON blob in a single annotation, or nest arbitrary structures. The DB column is `:jsonb, text: true` with no check constraint. Combined with the JSON-RPC batch limit of 50, a single batch request can submit 50 × (unbounded) bytes.

**Impact:** Storage abuse; potential OOM during JSON parsing.

**Evidence:** see snippet.

**Recommendation:** Enforce a max payload size at the HTTP layer (e.g. Rack middleware), and consider validating `dimensions`/`annotation` against `entry.dataset.labeling_configuration`.

**Effort:** M

---

### D20 — Low / Architecture — `notify_dataset_completed` sends emails synchronously in service

**File:** `app/service/dataset/service.rb:77-98`

**Description:** `notify_dataset_completed` iterates over project_owner members and calls `::Service::Notification.email(...)` inline. This is invoked from `DatasetsExpo#on_dataset_completed` (an event handler). `Service::Notification.email` publishes a Redis pub/sub event (per common lib), so the actual SMTP work is async — but the iteration and any Redis publish round-trip happen on the event-handler thread. For datasets with many project owners, this blocks the event handler.

**Impact:** Event handler latency; if Redis is slow, the dataset-completed event processing stalls.

**Evidence:** see snippet.

**Recommendation:** Acceptable as-is if project_owner counts are small; otherwise batch the notification into a single Redis publish.

**Effort:** S

---

### D21 — Low / Architecture — IAM HTTP call inside `after_commit`

**File:** `app/service/project_member/service.rb:47-63`

**Description:**

```ruby
project_members.after_commit do
  member_account = Api[:idah].iam.accounts.show(id: member.account_id)
  unless member_account.joined_at.nil?
    ::Service::Notification.email(...)
  end
end
```

An HTTP call to the IAM service is made inside an `after_commit` callback. `after_commit` runs after the DB transaction commits, but it still runs on the same thread that handled the request. If IAM is slow or down, the user's HTTP request to add a project member will hang or fail *after* the DB write has already committed — leaving the member created but no notification sent, with no retry.

**Impact:** User-visible latency; partial-failure state (member created, notification lost).

**Evidence:** see snippet.

**Recommendation:** Move the IAM lookup + email into a background job (the project has a job system per AGENTS.md), or publish a `project_member.created` event and let the notification service subscribe.

**Effort:** M

---

### D22 — Info / CodeSmell — `wf_step`/`status` not readonly on `Entry::Record`

**File:** `app/model/entry.rb:13-14`

**Description:**

```ruby
field :wf_step, type: String # , readonly: true
field :status, type: String # , readonly: true
```

The `readonly: true` is commented out, meaning any user with `:update` scope (project_owner) can set `wf_step` and `status` directly via PATCH `/entries/:id`, bypassing the workflow state machine. A project_owner could PATCH an entry directly to `status: "completed"` without going through `submit`, skipping review entirely (if `sample_rate < 1`).

**Impact:** Workflow integrity bypass for project_owners (who are trusted, but the workflow is the documented control).

**Evidence:** see snippet.

**Recommendation:** Re-enable `readonly: true` and route all transitions through the workflow service methods.

**Effort:** S

---

### D23 — Info / CodeSmell — Dead/commented `created_by_email` on Dataset

**File:** `app/model/dataset.rb` (no `created_by_email` field), `app/service/dataset/service.rb:55` (commented line)

**Description:** `Dataset::Service#create` has a commented-out line `# attributes[:created_by_email] ||= auth_context.metadata[:email]`, and the migration does not add a `created_by_email` column to `datasets`. The other "created" resources (project, annotation, note_feed, note_comment) all track creator email; dataset does not. This is either an oversight or an intentional omission — the audit trail for dataset creation is incomplete either way.

**Impact:** No audit trail for who created a dataset.

**Evidence:** `dataset/service.rb:55`.

**Recommendation:** Either add the column + populate it, or delete the commented line.

**Effort:** S

---

### D24 — Info / Security — Org-owner `update`/`delete` scope on note feeds/comments is creator-only

**File:** `app/model/note_comment.rb:60-66`, `app/model/note_feed.rb:67-73`

**Description:** For org owners, the `update`/`delete` scope on note feeds and note comments is `table.where(created_by_email: email)` — i.e. an org owner can only edit feeds/comments they personally created. This means an org owner cannot moderate (edit/delete) note feeds created by other users in their organization. The doc-comments at note_feed.rb:75-84 describe the *member* role policy, not the org-owner policy, so this may be intentional, but it limits org-owner moderation capability.

**Impact:** Org owners cannot moderate user-generated content in their org.

**Evidence:** `note_feed.rb:67-68`, `note_comment.rb:60-61`.

**Recommendation:** Confirm with product whether org owners should have full moderation rights; if so, broaden the scope.

**Effort:** S

---

### D25 — Info / Performance — Annotation triggers cause write amplification

**File:** `db/migrations/20250714000001_add_triggers_on_annotations.rb`

**Description:** Three triggers fire on every `INSERT`/`UPDATE` of annotations/entries/datasets, each issuing an `UPDATE` on the parent row to bump `updated_at`. Combined with the counter trigger on `entries` (initial schema), a single annotation insert causes: (1) `entries.updated_at` bump, (2) `datasets.updated_at` bump (via entries trigger), (3) `projects.updated_at` bump (via datasets trigger), (4) counter update on `datasets`. That is 4 additional writes per annotation insert. For the JSON-RPC batch path (up to 50 annotations), this is 200 extra writes per request.

**Impact:** Write amplification; relevant for high-throughput annotation workloads.

**Evidence:** see migration.

**Recommendation:** Consider batching `updated_at` bumps, or accepting the cost as a tradeoff for accurate `updated_at` propagation.

**Effort:** M

---

### D26 — Info / CodeSmell — Spec uses wrong RPC path

**File:** `app/expo/annotations_expo_spec.rb:116`

**Description:**

```ruby
def rpc_batch_call(calls)
  post "/annotations/rpc", calls, { "CONTENT_TYPE" => "application/json" }
end
```

The route is declared as `json_rpc http_path: "_rpc"` (annotations_expo.rb:27), which resolves to `/annotations/_rpc`. The spec posts to `/annotations/rpc` (no underscore). This `rpc_batch_call` helper is currently unused (the "batch" test at line 152 uses `rpc_call` with an array, which posts to the correct `rpc_endpoint = "/annotations/_rpc"`), so the bug is latent.

**Impact:** Dead helper that would fail if used.

**Evidence:** see snippet.

**Recommendation:** Delete `rpc_batch_call` or fix the path.

**Effort:** S

---

## Cross-cutting observations

1. **`Sequel.lit` usage is safe but fragile.** Every repository's `scoped` method builds raw SQL with `Sequel.lit(fragment, hash_params)`. Sequel parameterizes the hash values, so there is no SQL injection *today*. However, the role arrays (`%w[project_owner annotator reviewer]`) are interpolated as `IN :roles` placeholders, which Sequel expands to `IN (?, ?, ?)` with the array elements bound — this is safe. The risk is that a future contributor copies the pattern with string interpolation instead of placeholder binding. Consider extracting a single helper `build_role_check_sql(account_id, roles)` to centralize the pattern.

2. **`use_system` usage is justified.** The four `use_system` declarations (`Entry::Service`, `Dataset::Service`, `NoteFeed::Service`, `ProjectMember::Service`, `EntryStats::Service`) are all for: workflow transitions that reassign entries away from the current user (legitimate per AGENTS.md rule 2), account-deletion cascades, dataset progress updates after submit, and entry-stats recomputation from event handlers. None appear to expose user-controlled read paths through the system context. The one exception is `EntryStats::Recompute.persist` (D10), which instantiates a repo with `nil` instead of the system context — a bug rather than a misuse.

3. **No hardcoded UUIDs found.** All id generation uses `UUIDv7.generate` (Ruby) or `uuid_generate_v7()` (DB default). The spec files use literal UUIDs (`"3f8b9c0-..."`) which is acceptable for test fixtures.

4. **Resource constants are used consistently.** `Resource::Dataset::Annotations`, `Resource::Dataset::Entries`, etc. are used throughout; no hardcoded `"annotations"` strings in event channels or JSON:API types were found in the audited files.

5. **Layered isolation is respected.** Expositions call services; services call repositories; repositories are the only layer that touches `table`/SQL. No exposition calls a repository directly. The one architectural smell is `EntryStats::Recompute` (a "service-layer" module) instantiating a repository directly (D10).

---

## Files reviewed

All 70 `.rb` files under `idah/app/dataset/app/` (expo, model, model/workflow, service/*, util), `config/boot.rb`, `config/routes.rb`, `config/puma.rb`, `config/config.yml`, all four `config/initializers/*.rb`, all six `db/migrations/*.rb`, `Gemfile`, `config.ru`, `dev-entrypoint.sh`. Spec files were read for cross-referencing behavior but are not individually cited unless they themselves contain issues (D26).
