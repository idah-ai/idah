# Job System (Media/Sync)

## Overview

Both the Media and Sync services share an identical job processing infrastructure with different concrete implementations. The infrastructure consists of three core classes — `Jobs::Base`, `Jobs::Scheduler`, and `Jobs::Record` — plus a `Jobs::Service` for CRUD operations. This is a prime candidate for extraction to `common/` to eliminate duplication.

The job system provides:

- **Asynchronous execution** of background work via a configurable thread pool
- **PostgreSQL-backed persistence** with row-level locking (`FOR UPDATE SKIP LOCKED`)
- **Priority scheduling** (higher integer = more urgent)
- **Automatic retry** with exponential backoff
- **Progress tracking** (float 0.0–1.0)
- **Event emission** from repositories for observability

---

## Architecture

### Data Flow

```
# Media Service — event-driven processing
Entry Created (event) → Processor::Service#process_entry
  → Jobs::Service#create → Jobs::Record (pending)
  → Jobs::Scheduler polls → locks → dispatches to ThreadPool
  → Processor::Job#run_impl → processor.export() → update entry

# Sync Service — HTTP-driven export
Export Request (HTTP) → Exports::Service#create
  → Jobs::Service#create → Jobs::Record (pending)
  → Jobs::Scheduler polls → locks → dispatches to ThreadPool
  → Exports::Job#run_impl → exporter.export() → upload result to Shrine
```

---

## Jobs::Record Schema

Both services define an identical `Jobs::Record` class (scoped to different resource constants).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUIDv7 (PK) | Primary key, generated via `UUIDv7.generate` |
| `job_class` | String | Constantized at runtime to find the Ruby class |
| `arguments` | JSONB | Arbitrary job arguments, encoded via `JsonEncoder` |
| `priority` | Integer | Higher values = more urgent scheduling |
| `status` | String | One of: `pending`, `running`, `completed`, `errored` |
| `progress` | Float | 0.0–1.0, updated during job execution |
| `retry_count` | Integer | Incremented on each reschedule |
| `error` | Text | Error message from the last failure |
| `unicity` | String | Reserved for future deduplication (unused) |
| `scheduled_at` | Timestamp | When the job is eligible for execution |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

**Media-specific difference**: The Media `Jobs::Record` is typed with `Resource::Media::Jobs`. It has no associations.

**Sync-specific difference**: The Sync `Jobs::Record` is typed with `Resource::Sync::Jobs` and has a `has_many :exports` association linking to the exports table.

### Resource Constants

```ruby
# Media
type Resource::Media::Jobs

# Sync
type Resource::Sync::Jobs
```

---

## Jobs::Record / Repository (Media)

The Media Service's scoping is based on resource access via the arguments JSONB field:

```ruby
# Media scoping — filtered by arguments->>'resource'
def scope_with_media_resources(action)
  case action
  when :read
    media_repo = Medias::Repository.new(auth_context)
    resources = media_repo.index({}).map(&:resource).uniq
    table.where(Sequel.lit("arguments->>'resource' IN ?", resources))
  end
end
```

This ensures a user can only see jobs for media resources they have access to.

### Repository Methods

| Method | SQL | Description |
|--------|-----|-------------|
| `lock_available(count)` | `SELECT ... FOR UPDATE SKIP LOCKED` | Locks pending jobs and sets status → `running` |
| `update_progress(id, value)` | `UPDATE progress` | Emits `progressed` event |
| `complete(id)` | `UPDATE status='completed', progress=1.0` | Emits `completed` event |
| `reschedule(id, scheduled_at:, error:)` | `UPDATE status='pending', retry_count+1` | Emits `rescheduled` event |
| `error(id, error)` | `UPDATE status='errored'` | Emits `errored` event |
| `next_scheduled_time` | `SELECT MIN(scheduled_at) WHERE status='pending'` | Used by scheduler to determine sleep duration |

All mutation methods use `no_event` blocks internally to avoid double-dispatch of "updated" events since they emit their own specific events.

---

## Jobs::Record / Repository (Sync)

The Sync Service's scoping is more complex, validating access through the `exports` relationship:

```ruby
# Org owner scoping — exports for projects in user's orgs
scope.as_org_owner? {
  org_ids = auth_context.custom_scopes[:org]
  project_ids = Api[:idah].dataset.projects.index_all(
    filter: { organization_id: org_ids },
    fields: { "dataset:projects": ["id"] }
  ).map(&:id)

  table.where(Sequel.lit(<<-SQL, project_ids:))
    EXISTS (
      SELECT 1 FROM exports
      WHERE exports.job_id = jobs.id
        AND exports.project_id IN :project_ids
    )
  SQL
}

# User scoping — exports for projects the user owns
scope.as_user? {
  account_id = auth_context.metadata[:id]
  project_ids = Api[:idah].dataset.project_members.index_all(
    filter: { account_id:, role: "project_owner", enabled: true },
    fields: { "dataset:project_members": ["project_id"] }
  ).map(&:project_id).uniq

  # Same EXISTS subquery pattern
}
```

This inter-service API call pattern (`Api[:idah].dataset.*`) is how Sync validates that a user's export job belongs to a project they have rights to see.

### Full Scoping Hierarchy

| Scope | Access Rule |
|-------|------------|
| `all?` | Full table access (admin / system context) |
| `as_org_owner?` | Jobs whose exports belong to projects in the user's organizations |
| `as_user?` | Jobs whose exports belong to projects where the user is a `project_owner` |

---

## Jobs::Base (Abstract Class)

```ruby
module Jobs
  class Base
    @max_retries = 0

    class << self
      attr_accessor :max_retries
    end

    attr_reader :job_id, :arguments

    def initialize(job_id, arguments)
      @job_id = job_id
      @arguments = arguments
    end

    def update_progress(value)
      emit(:update_progress, value:)
    end

    def reschedule(after: 10)
      emit(:reschedule, after:)
    end

    def error(message)
      emit(:error, error: message)
    end

    def emit(event, **args)
      @command.call(event, **args)
    end

    def run(&block)
      @command = block
      run_impl
    rescue StandardError => e
      error(e)
    end

    def run_impl
      raise NotImplementedError
    end
  end
end
```

### How It Works

1. **Initialization**: Each job receives a `job_id` (string UUID) and `arguments` (hash). These are set by the scheduler when it instantiates the job class.

2. **`run(&block)`**: Accepts a callback block that the scheduler provides. The block is stored as `@command` and called via `emit` for three lifecycle events: `:update_progress`, `:reschedule`, and `:error`. Any unhandled `StandardError` in `run_impl` is automatically caught and converted to an error emission.

3. **`run_impl`**: Subclasses implement this. This is where the actual job logic goes. Within `run_impl`, subclasses call `update_progress`, `reschedule`, or `error` to communicate back to the scheduler.

4. **`max_retries`**: Class-level attribute, configurable per subclass. Defaults to `0` (no retries). The scheduler reads this via `klass.max_retries`.

### Lifecycle Signals

| Signal | Method | Effect |
|--------|--------|--------|
| `update_progress(value)` | `update_progress(value)` | Updates progress in DB, continues execution |
| `reschedule(after:)` | `reschedule(after:)` | Stops current execution, reschedules with delay |
| `error(message)` / `error(exception)` | `error(message)` | Stops current execution, retries or marks errored |

The `error` method accepts both strings and `StandardError` objects. The scheduler normalizes exceptions to `"ClassName: message"` format.

---

## Jobs::Service

A thin CRUD wrapper over the repository, shared identically by both services:

```ruby
module Jobs
  class Service < Verse::Service::Base
    use Jobs::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      repo.index(filter, included:, page:, items_per_page:, sort:, query_count:)
    end

    def show(id, included: [])
      repo.find!(id, included:)
    end

    def delete(id)
      repo.delete(id)
    end

    def create(job_class, arguments: {}, priority: 0, scheduled_at: Time.now, unicity: nil)
      repo.transaction do
        record = {
          job_class:,
          arguments:,
          priority:,
          status: "pending",
          scheduled_at:,
          unicity:,
          retry_count: 0,
          progress: 0.0
        }
        record_id = repo.create(record)
        repo.find!(record_id)
      end
    end

    def update(record)
      repo.update!(record.id, record.attributes)
      repo.find!(record.id)
    end
  end
end
```

Jobs are always created with `status: "pending"`, `retry_count: 0`, and `progress: 0.0`. The `unicity` field is reserved for future use.

---

## Jobs::Scheduler

The scheduler is a singleton in each service, initialized at boot time and stored in a `SCHEDULER` constant.

### Initialization

```ruby
# config/initializers/scheduler.rb (Media and Sync — identical)
SCHEDULER = Jobs::Scheduler.new

Verse.on_stop do
  SCHEDULER.stop
end

if ENV["PUMA_WORKERS"] && ENV["PUMA_WORKERS"] == "1"
  Verse.on_boot do
    SCHEDULER.start
  end
else
  # Multi-worker: puma on_worker_boot handles it
end
```

### Constructor

```ruby
def initialize
  super Verse::Auth::Context.new  # System context
  self.class.instance ||= self
  @wait_cond = new_cond           # MonitorMixin condition variable
  @running = false
end
```

The scheduler uses a **system auth context** (no user scoping) because job processing happens asynchronously — there is no HTTP request context available when the thread pool worker runs.

### Thread Pool

The thread pool is created when `start` is called:

```ruby
def start
  stop if running
  synchronize { @running = true }
  @thread_pool = ThreadPool.new(
    size: Verse.config.extra_fields.dig(:idah, :jobs, :concurrency) || 4
  )
  @scheduler = Thread.new(&method(:run))
end
```

Concurrency is configurable via `IDAH_JOBS_CONCURRENCY` environment variable (mapped through `Verse.config.extra_fields[:idah][:jobs][:concurrency]`). Default: 4.

The `ThreadPool` class (defined in `common/lib/thread_pool.rb`) manages a fixed-size pool of worker threads. It uses a `MonitorMixin`-synchronized `Queue` for task distribution. Each worker pulls tasks from the queue, increments `@usage` while running, and decrements when done. The scheduler checks `@thread_pool.free` (= `@size - @usage`) to determine how many new jobs to lock.

### Polling Loop

```ruby
def run
  while running
    synchronize do
      # 1. Lock available jobs
      free = @thread_pool.free
      if free > 0
        available_jobs = jobs.lock_available(free)
        available_jobs.each(&method(:process))
      end

      # 2. Determine sleep duration
      time = jobs.next_scheduled_time

      if time.nil?
        @wait_cond.wait(60)        # No jobs — sleep 60s
      else
        next_in = time.to_f - Time.now.to_f
        if next_in > 0
          @wait_cond.wait(next_in) # Wait until next job is ready
        else
          @wait_cond.wait(1.0)     # Late jobs — brief sleep to avoid busy loop
        end
      end
    end
  end
end
```

Key behaviors:

- **Locks up to `free` jobs** in a single transaction using `FOR UPDATE SKIP LOCKED`, sorted by descending priority
- **Sleeps** until the next scheduled job, or 60s if none exist, or 1s if jobs are overdue
- **`signal`** method wakes the scheduler early (used when new jobs are created):
  ```ruby
  def signal
    synchronize { @wait_cond.signal }
  end
  ```

### Job Dispatch (process)

```ruby
def process(job)
  klass = Verse::Util::Reflection.constantize(job.job_class)

  unless klass < Jobs::Base
    raise "Job class #{job.job_class} is not a valid Jobs::Base subclass"
  end

  @thread_pool.run do
    catch :stop do
      klass.new(job.id, job.arguments).run do |command, **opts|
        case command
        when :update_progress
          jobs.update_progress(job.id, opts[:value])
        when :reschedule
          reschedule_in = Time.now + opts.fetch(:after, 10)
          jobs.reschedule(job.id, "pending", scheduled_at: reschedule_in)
          throw :stop
        when :error
          error = opts[:error]
          error_message = if error.is_a?(String) then error
                          else "#{error.class}: #{error.message}" end

          if job.retry_count < (klass.max_retries || 0)
            retry_delay = 5 * (2 ** (job.retry_count * 1.5)).to_i
            jobs.reschedule(job.id, scheduled_at: Time.now + retry_delay,
                                    error: error_message)
          else
            jobs.error(job.id, error: error_message)
          end
          throw :stop
        end
      end
      jobs.complete(job.id)  # Success path
    end
  rescue StandardError => e
    jobs.error(job.id, error: "#{e.class.name}: #{e.message}")
  end
end
```

**Security check**: `klass < Jobs::Base` prevents arbitrary code execution if the database were poisoned with a malicious `job_class` string.

### Retry Logic

| Condition | Action |
|-----------|--------|
| `retry_count < max_retries` | Reschedule with exponential backoff: `5 × 2^(n × 1.5)` seconds |
| `retry_count >= max_retries` | Mark as `errored`, store final error message |

**Exponential backoff examples** (for `max_retries ≥ 3`):

| Retry Count | Delay (seconds) | Approx. |
|-------------|-----------------|---------|
| 0 | `5 × 2^(0)` = 5 | 5s |
| 1 | `5 × 2^(1.5)` ≈ 14 | 14s |
| 2 | `5 × 2^(3)` = 40 | 40s |
| 3 | `5 × 2^(4.5)` ≈ 113 | ~2min |

### Graceful Shutdown

```ruby
def stop
  return unless running
  synchronize do
    @running = false
    @wait_cond.signal
  end
  @thread_pool.stop
  @scheduler.join
end
```

### Pause Mechanism

```ruby
def pause(&block)
  synchronize(&block)
end
```

The `pause` method takes advantage of `MonitorMixin` synchronization: while the block executes, the polling loop cannot acquire the monitor, effectively pausing job dispatch. This is used during tests or maintenance.

---

## Media Jobs

### Processor::Job

Created by `Processor::Service#process_entry` when a new entry is detected:

```ruby
jobs.create(
  job_class: "Processor::Job",
  arguments: {
    entry_id:,
    processor_class_name:,
    options_class_name:,
    resource:,
    options: {}
  },
  priority: 1,
  scheduled_at: Time.now
)
```

The job implementation:

```ruby
module Processor
  class Job < Jobs::Base
    def run_impl
      processor_class_name = arguments.fetch(:processor_class_name)
      options_class_name   = arguments.fetch(:options_class_name)
      options = arguments.fetch(:options, {})

      processor_class = Verse::Util::Reflection.constantize(processor_class_name)
      options_class   = Verse::Util::Reflection.constantize(options_class_name)

      context = Processor::Context.new(
        Verse::Auth::Context.new,
        self,
        arguments.fetch(:resource),
        options_class.new(**options)
      )

      processor_class.new(context).run
    end
  end
end
```

**Flow**:
1. Constantize the processor class (e.g., `IdahVideo::VideoProcessor`) and options class
2. Build a `Processor::Context` with the job instance, resource identifier, and configuration
3. Instantiate the processor and call `.run`

### Processor::Service

```ruby
module Processor
  class Service < Verse::Service::Base
    use_system jobs: Jobs::Repository

    def process_entry(entry_id)
      entry = Api[:idah].dataset.entries.show(id: entry_id, included: %w[dataset])
      modality = entry.dataset.modality

      # Skip if a job already exists and is running
      if entry.job_id
        job = jobs.find(entry.job_id)
        return if job && %w[pending running].include?(job.status)
      end

      processor_entries = Registry.get(modality)

      if processor_entries.nil? || processor_entries.empty?
        Api[:idah].dataset.entries.update(id: entry.id, status: "ready")
        return
      end

      processor_entries.each do |processor_entry|
        job_id = jobs.create(
          job_class: "Processor::Job",
          arguments: {
            entry_id:,
            processor_class_name: processor_entry.class_name,
            options_class_name: processor_entry.options_class_name,
            resource: entry.resource,
            options: {}
          },
          status: "pending",
          priority: 1,
          scheduled_at: Time.now
        )
        Api[:idah].dataset.entries.update(id: entry.id, status: "processing", job_id:)
      end
    end
  end
end
```

Key behaviors:

- Called **event-driven** when a new entry is created (subscribes to dataset entry events)
- Checks the entry's modality to find matching processors
- Idempotency check: skips if a job for this entry is already pending or running
- Creates one job per registered processor entry
- Updates the entry status to `"processing"` and stores the `job_id`
- If no processor matches the modality, sets entry status to `"ready"`

### Processor::Registry

```ruby
module Processor
  module Registry
    extend self

    Entry = Data.define(:plugin, :class_name, :options_class_name)

    def register(plugin_name, modality, class_name:, options_class_name: "Schema::Empty")
      modality = modality.to_sym
      @processors[modality] ||= []
      @processors[modality] << Entry.new(
        plugin: plugin_name.to_sym,
        class_name:,
        options_class_name:
      )
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @processors.each_value { |coll| coll.reject! { |entry| entry.plugin == plugin_name } }
    end

    def clear_all
      @processors.clear
    end

    def get(name)
      name = name.to_sym
      entries = @processors[name]
      entries&.dup  # Returns nil if no entries, or array of Entry structs
    end
  end
end
```

The `Entry` data struct contains:

| Field | Description |
|-------|-------------|
| `plugin` | Symbol — plugin name (e.g., `:idah_video`) |
| `class_name` | String — fully qualified Ruby class name |
| `options_class_name` | String — schema class for job options (default: `"Schema::Empty"`) |

**Registration happens via the plugin lifecycle**:

```ruby
class PluginLifecycleContext
  def register_processor(name, class_name:, options_class_name: "Schema::Empty")
    Processor::Registry.register(@plugin_name, name, class_name:, options_class_name:)
  end
end
```

### Processor::Context

Provides processors with access to the entry's media and the job's lifecycle:

```ruby
module Processor
  class Context
    attr_reader :resource, :config, :job

    def download_original
      # Downloads original media (key: "") from Shrine storage
    end

    def update_original_metadata(metadata)
      # Updates media metadata on the original media record
    end

    def upload_media(io, key, mime_type, metadata = {})
      # Uploads processed media to Shrine, creates media record
      # Handles rollback: deletes uploaded file if DB transaction rolls back
    end

    def progress=(progress)
      job.update_progress(progress)
    end

    def reschedule!(after: 10)
      job.reschedule(after:)
    end

    def error!(message)
      job.error(message)
    end
  end
end
```

The context wraps both the job lifecycle signals (`progress=`, `reschedule!`, `error!`) and media operations (`download_original`, `upload_media`). Processors interact with this context rather than calling repositories directly.

---

## Sync Jobs

### Exports::Job

Created when a user requests an export:

```ruby
jobs.create(
  "Exports::Job",
  arguments: {
    exporter: "Exports::Upd::Exporter",
    dataset_ids: [1, 2, 3],
    options: { include_medias: "original" }
  }
)
```

The job implementation:

```ruby
module Exports
  class Job < Jobs::Base
    def run_impl
      options, dataset_ids = arguments.values_at(:options, :dataset_ids)
      export_class = arguments[:exporter]

      export_context = Exports::Context.new(self, dataset_ids, options)

      export_class = Verse::Util::Reflection.constantize(export_class)
      export_class.new.export(export_context)

      import_file =
        case export_context.io.mode
        when :file then export_context.io.file.rewind; export_context.io.file
        when :dir  then File.open(export_context.io.zip_directory)
        else raise "Invalid IO mode: #{export_context.io.mode}"
        end

      export = exports.index({ job_id: }, items_per_page: 1).first
      exports.upload(export.id, import_file)
    ensure
      export_context.io&.cleanup
    end

    private

    def exports
      @exports ||= Exports::Service.new(Verse::Auth::Context.new)
    end
  end
end
```

**Flow**:

1. Extract `options`, `dataset_ids`, and `exporter` class name from arguments
2. Build an `Exports::Context` with the job instance, dataset IDs, and options
3. Constantize the exporter class (e.g., `Exports::Upd::Exporter`) and call `exporter.export(context)`
4. Handle the output:
   - **File mode** (`:file`): rewind and upload the temp file
   - **Directory mode** (`:dir`): zip the directory, then upload
5. Upload to Shrine storage via `Exports::Service#upload`
6. Always clean up temp files in `ensure`

### Exports::Service

```ruby
module Exports
  class Service < Verse::Service::Base
    use exports: Exports::Repository
    use_system jobs: Jobs::Service

    def create(project_id, dataset_ids, exporter, options = {})
      sanitize_export_class!(exporter)
      dataset_ids = filter_dataset_ids_by_rights(project_id, dataset_ids)

      if dataset_ids.empty?
        raise Verse::Error::Authorization,
              "You do not have access to any of the datasets provided"
      end

      exports.transaction do
        job = jobs.create("Exports::Job", arguments: { exporter:, dataset_ids:, options: })
        export_id = exports.create({
          job_id: job.id,
          project_id:,
          created_by_id: auth_context.metadata[:id]
        })
        exports.find!(export_id, included: [:job])
      end
    end

    def upload(id, file)
      export = exports.find!(id)
      filename = File.basename(file.path)

      Verse::Plugin[:shrine].with_storage do |storage|
        stored = storage.upload(file)

        exports.table.db.after_rollback do
          storage.delete(stored.id) if stored
        end

        exports.update(export.id, {
          file_id: stored.id,
          filename:,
          size: stored.size,
          mime_type: stored.mime_type
        })
      end

      exports.find!(export.id)
    end
  end
end
```

Key behaviors:

- **Authorization**: Validates the exporter class is registered, then filters dataset IDs through the auth context (org owner / project owner checks via inter-service API)
- **Sanitization**: Calls `Exports::Registry.valid_export_class?` to ensure the exporter is registered — prevents arbitrary code execution
- **Transactional**: Creates the job and export record in a single transaction
- **Upload**: Uses Shrine storage with rollback cleanup (`after_rollback` deletes the uploaded file if the DB transaction fails)

### Exports::Registry

```ruby
module Exports
  module Registry
    extend self

    def register(plugin_name, modalities, klass)
      modalities = [modalities] unless modalities in Array
      @registry ||= {}

      modalities.each do |modality|
        unless modality in String | Regexp
          raise ArgumentError, "modality selector must be String or Regexp"
        end
        @registry[modality] ||= Set.new

        klass.define_singleton_method(:plugin) { plugin_name.to_sym }
        @registry[modality] << klass
      end
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @registry.each_value { |coll| coll.reject! { |klass| klass.plugin == plugin_name } }
    end

    def clear_all = @registry.clear

    def valid_export_class?(klass)
      @registry.each_value.any? { |v| v.map(&:to_s).include?(klass) }
    end

    def list_export_format(modalities)
      formats = Set.new
      modalities.uniq.each do |modality|
        @registry.each do |key, value|
          formats += value if (key.is_a?(String) && key == modality) ||
                              (key.is_a?(Regexp) && modality =~ key)
        end
      end
      formats.uniq
    end

    def list_export_format_details(modalities)
      list_export_format(modalities).map do |klass|
        exporter = klass.new
        { name: exporter.name, description: exporter.description, exporter: klass.to_s }
      end
    end
  end
end
```

The registry supports modality matching via both exact strings and regex patterns. For example, the UPD exporter registers with `/.*/` (matches everything):

```ruby
# config/initializers/default_export_formats.rb
Exports::Registry.register("*", /.*/, Exports::Upd::Exporter)
```

### Exports::Context Hierarchy

```
Exports::Context
├── io              → IoContext (temp file / temp dir / zip)
├── datasets        → Enumerator of DatasetContext
│   └── entries     → Array of EntryContext
│       ├── annotations  → Array of AnnotationContext
│       └── medias       → Array of MediaContext (with download)
```

#### Context

```ruby
module Exports
  class Context
    attr_reader :dataset_ids, :options

    def io
      @io ||= IoContext.new
    end

    def progress=(value)
      @job.progress = value
    end

    def datasets
      Enumerator.new do |yielder|
        size = @dataset_ids.size
        @dataset_ids.each_with_index do |id, idx|
          yielder << DatasetContext.new(id)
          @job.update_progress((idx + 1.0) / size)
        end
      end
    end
  end
end
```

The `datasets` enumerator automatically reports progress — each dataset processed advances progress by `1.0 / total_datasets`.

#### IoContext

```ruby
module Exports
  class IoContext
    attr_reader :mode  # :file or :dir

    def file=(file)               # Set a pre-existing file
    def file(format: nil)         # Create or return temp file
    def directory                 # Create or return temp directory
    def zip_directory             # Zip the temp directory → file path
    def cleanup                   # Remove all temp files/directories
  end
end
```

Exporters can write output as either:
- **File mode** (`:file`): single temp file (e.g., UPD format)
- **Directory mode** (`:dir`): directory of files, later zipped by the job

#### DatasetContext

```ruby
module Exports
  class DatasetContext
    attr_reader :record

    def initialize(id)
      @record = Api[:idah].dataset.datasets.show(id:)
    end

    def entries(filter = {})
      Api[:idah].dataset.entries.index_all(
        filter: filter.merge(dataset_id: @record.id)
      ).map { |entry| EntryContext.new(entry) }
    end
  end
end
```

Fetches dataset data and entries via inter-service API calls to the Dataset service.

#### EntryContext

```ruby
module Exports
  class EntryContext
    attr_reader :record

    def annotations(filter = {})
      Api[:idah].dataset.annotations.index_all(
        filter: filter.merge(entry_id: @record.id),
        included: ["project_members"]
      ).map { |a| AnnotationContext.new(a) }
    end

    def medias(filter = {})
      Api[:idah].media.medias.index_all(
        filter: filter.merge(resource: @record.resource)
      ).map { |m| MediaContext.new(m) }
    end
  end
end
```

#### MediaContext

```ruby
module Exports
  class MediaContext
    attr_reader :record

    def download
      Api[:idah].media.medias.files(resource: @record.resource, key: @record.key)
    end
  end
end
```

Downloads media binary data from the Media service's file endpoint.

#### AnnotationContext

```ruby
module Exports
  class AnnotationContext
    attr_reader :record
  end
end
```

A lightweight wrapper over the annotation record.

### UPD Exporter

The Universal Portable Dataset (UPD) exporter uses the `updcli-static` command-line binary:

```ruby
module Exports
  module Upd
    class Exporter
      def name = "Universal Portable Dataset"
      def description = "Export to UPD file."

      def export(context)
        file_path = "/tmp/idah-export-#{Time.now.to_i}.upd"

        system("updcli-static --input #{file_path} init", exception: true)

        context.datasets.each do |dataset|
          append_dataset(file_path, dataset)

          dataset.entries.each do |entry|
            include_medias = context.options[:include_medias]
            append_entry(file_path, dataset.record.id, entry, include_medias)

            entry.annotations.each { |a| append_annotation(file_path, entry.record.id, a) }

            # Filter medias based on include_medias option
            medias = case include_medias
                     when "original" then entry.medias({ key: "" })
                     when "all"      then entry.medias
                     else []
                     end

            medias.each { |media| append_media(file_path, media) }
          end
        end

        context.io.file = File.open(file_path)
      end
    end
  end
end
```

**UPD CLI commands**:

| Step | Command | Purpose |
|------|---------|---------|
| Init | `updcli-static --input file.upd init` | Creates empty UPD file |
| Dataset | `dataset create --id --name --modality --metadata` | Appends dataset |
| Entry | `entry create --id --dataset_id --url --metadata` | Appends entry (URL points to IDAH or `local:` prefix) |
| Annotation | `annotation create --id --entry_id --type --shape --annotation --metadata` | Appends annotation |
| Media | `media create --id --file --key --mimetype` | Embeds media binary in UPD |

**Media URL strategy**:
- If `include_medias` is `"original"` or `"all"`: URL is `local:<resource>` (media is embedded in the UPD file)
- Otherwise: URL is the IDAH API endpoint (`IDAH_URL/api/v1/media/medias/files/<resource>`)

---

## Differences Between Media and Sync

| Aspect | Media Service | Sync Service |
|--------|--------------|--------------|
| **Job scoping** | Via `arguments->>'resource'` — matches against user's accessible media resources | Via `EXISTS (SELECT 1 FROM exports WHERE exports.job_id = jobs.id AND exports.project_id IN :project_ids)` — validates project membership |
| **Trigger** | Event-driven — `Processor::Service#process_entry` called when an entry is created | HTTP-driven — `Exports::Service#create` called when a user requests an export |
| **Concrete job** | `Processor::Job` — runs a processor plugin on an entry's media | `Exports::Job` — runs an exporter plugin, uploads result to Shrine |
| **Registry** | `Processor::Registry` — keyed by modality symbol, returns `Entry` structs | `Exports::Registry` — keyed by string/regexp modality patterns, returns export classes |
| **Output** | Processor modifies entry state directly (uploads processed media, updates metadata) | File uploaded to Shrine storage via `Exports::Service#upload` |
| **Scheduler init** | `SCHEDULER = Jobs::Scheduler.new` in `config/initializers/scheduler.rb` | Identical pattern |
| **Context** | `Processor::Context` — provides download/upload media, progress, reschedule | `Exports::Context` hierarchy — provides iterable datasets, entries, annotations, medias |
| **Record association** | No associations on `Jobs::Record` | `Jobs::Record` has `has_many :exports` |

---

## Shared Infrastructure (Duplicated)

The following files are **identical** between Media and Sync (candidates for extraction to `common/`):

| File | Media | Sync |
|------|-------|------|
| `Jobs::Base` | `app/service/jobs/base.rb` | `app/service/jobs/base.rb` |
| `Jobs::Scheduler` | `app/service/jobs/scheduler.rb` | `app/service/jobs/scheduler.rb` |
| `Jobs::Service` | `app/service/jobs/service.rb` | `app/service/jobs/service.rb` |
| Scheduler initializer | `config/initializers/scheduler.rb` | `config/initializers/scheduler.rb` |

The `Jobs::Record` and `Jobs::Repository` files are **near-identical**, differing only in:

1. The resource type constant (`Resource::Media::Jobs` vs `Resource::Sync::Jobs`)
2. The `scoped` method implementation (media resource access vs export project membership)

---

## Configuration

| Environment Variable | Config Path | Default | Description |
|---------------------|-------------|---------|-------------|
| `IDAH_JOBS_CONCURRENCY` | `verse.config.extra_fields[:idah][:jobs][:concurrency]` | `4` | Number of worker threads in the thread pool |

---

## Testing

### Scheduling Tests

Both services share an identical scheduler spec pattern using test job classes:

```ruby
module Spec
  class CustomJob < Jobs::Base
    class << self; attr_accessor :ran; end

    def initialize(job_id, arguments)
      super
      self.class.ran = false
    end

    def run_impl
      self.class.ran = true
    end
  end

  class UpdateProgressJob < Jobs::Base
    def run_impl
      update_progress(0.5)
    end
  end

  class RescheduleJob < Jobs::Base
    def run_impl
      reschedule(after: 60)
    end
  end

  class ErrorJob < Jobs::Base
    def run_impl
      error("Something went wrong")
    end
  end

  class RetryJob < Jobs::Base
    def run_impl
      error("Will retry")
    end
  end
end
```

These test jobs exercise every code path in the scheduler: completion, progress updates, rescheduling, error handling with max retries exhausted, and error handling with retries remaining.

### Service and Repository Tests

- **Jobs::Service specs** verify creation with correct default attributes
- **Jobs::Repository specs** verify scoping, locking, and status transitions
- **Processor::Service specs** verify event-driven job creation with proper modality lookup
- **Exports::Service specs** verify authorization filtering, exporter validation, and transactional creation
