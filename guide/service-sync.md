# Sync Service

## Overview

The Sync Service handles **dataset export generation** across all annotation modalities. When a user requests an export, the service creates a job, runs the appropriate exporter to generate the output file, and uploads the result via Shrine for download.

Exports are modality-aware — each modality registers its own exporter class via the `PluginLifecycleContext`. A default UPD (Universal Project Data) exporter is registered for all modalities and serves as the universal fallback.

---

## Models

### Jobs::Record

Standard job record — identical to the schema described in [`guide/job-system.md`](guide/job-system.md).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `type` | `text` | Job type discriminator (always `export` for Sync Service) |
| `status` | `text` | `pending`, `running`, `completed`, `failed` |
| `metadata` | `jsonb` | Job payload: `export_id`, `exporter_class`, modality info |
| `scheduled_at` | `timestamptz` | When the job should be picked up |
| `started_at` | `timestamptz` | When processing started |
| `completed_at` | `timestamptz` | When processing finished |
| `error` | `jsonb` | Error details on failure |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### Exports::Record

Shrine-backed export file record stored in the `exports` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `job_id` | `uuid` | Foreign key to `jobs.id` |
| `project_id` | `uuid` | The project being exported |
| `created_by_id` | `uuid` | Account ID that requested the export |
| `file_id` | `text` | Shrine file identifier |
| `filename` | `text` | Original export filename |
| `mime_type` | `text` | MIME type of the export file |
| `size` | `bigint` | File size in bytes |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

The `file_id` field integrates with Shrine for storage. The actual file data is managed by the `Exports::Uploader` (a Shrine uploader subclass), and the Shrine `file_data` column is stored alongside.

```ruby
class Exports::Record < Sequel::Model(:exports)
  include Verse::Model
  include Exports::Uploader::Attachment.new(:file)

  many_to_one :job, class: :'Jobs::Record', key: :job_id

  plugin :timestamps, update_on_create: true
end
```

---

## Endpoints

### HTTP — `/exports`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/exports` | Authenticated | List exports (paginated, filterable) |
| `GET` | `/exports/:id` | Authenticated | Show export details |
| `GET` | `/exports/:id/download` | Authenticated | Download the export file (streaming) |
| `POST` | `/exports` | Authenticated | Request a new export |
| `GET` | `/exports/formats` | Authenticated | List available export formats (per modality) |

### Export Request Flow

```
POST /exports
  Body: { project_id, dataset_id, format: "upd" (or modality id) }
  → Exports::Service.create(...)
    1. Creates Exports::Record (status: pending)
    2. Creates Jobs::Record (type: "export", status: "pending")
    3. Returns JSON:API Exports::Record with job link
  → 202 Accepted
```

```ruby
expose on_http(:post, "/") do
  input do
    field :project_id, String
    field :dataset_id, String
    field :format, String, default: "upd"
  end
end
def create
  export = service.create(
    project_id: params[:project_id],
    dataset_id: params[:dataset_id],
    format: params[:format]
  )
  renderer.status = 202
  export
end
```

### Download Flow

```
GET /exports/:id/download
  → Exports::Service.download(id)
    1. Look up Exports::Record
    2. Open Shrine file handle
    3. Stream file content with correct Content-Type/Disposition headers
```

### Formats Discovery

```
GET /exports/formats
  → Exports::Service.available_formats
    1. Iterate Exports::Registry.exporters
    2. Return modality → exporter metadata mapping
  → [{ modality_id: "idah-video", format: "upd", label: "UPD Export" }, ...]
```

### HTTP — `/jobs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/jobs` | Authenticated | List export jobs (paginated) |
| `GET` | `/jobs/:id` | Authenticated | Show job details |
| `DELETE` | `/jobs/:id` | Authenticated | Cancel/delete a job |

---

## Key Services

### Exports::Service

Orchestrates export creation, status tracking, and file retrieval.

```ruby
class Exports::Service < Verse::Service::Base
  use_repository Exports::Repository

  def create(project_id:, dataset_id:, format: "upd")
    exporter_class = Exports::Registry.for(format)
    raise Verse::Error::InvalidInput, "Unknown format: #{format}" unless exporter_class

    DB.transaction do
      export = repository.create!(
        project_id:,
        status: "pending"
      )
      Jobs::Service.create(
        type: "export",
        metadata: {
          export_id: export.id,
          exporter_class: exporter_class.name,
          dataset_id:,
          project_id:
        }
      )
      export
    end
  end

  def download(id)
    record = repository.find!(id)
    file = record.file
    # Return streaming body with headers
  end

  def available_formats
    Exports::Registry.exporters.map do |modality_id, klass|
      { modality_id:, format: klass.format_name, label: klass.label }
    end
  end
end
```

The `create` method uses a **dual-transaction pattern**:

1. Create the `Exports::Record`
2. Create the `Jobs::Record` referencing the export

If either fails, the transaction rolls back cleanly. Once both are committed, the `Jobs::Scheduler` will pick up the job.

### Exports::Registry

Maps modality IDs / format names to exporter classes.

```ruby
class Exports::Registry
  class << self
    def register(modality_regex, exporter_class)
      exporters[modality_regex] = exporter_class
    end

    def for(format_name)
      exporters.each do |regex, klass|
        return klass if regex.match?(format_name)
      end
      nil
    end

    def exporters
      @exporters ||= {}
    end
  end
end
```

Registration uses regex keys so a single exporter can match multiple modalities:

```ruby
# Default: UPD exporter matches everything
Exports::Registry.register(/.*/, Exports::Upd::Exporter)

# Plugin: custom exporter for video
Exports::Registry.register(/idah-video/, MyVideoExporter)
```

Registration happens at boot time via the `PluginLifecycleContext` (see below).

### Exports::Job

Wraps exporter execution in the job system.

```ruby
class Exports::Job < Jobs::Base
  def run
    export = Exports::Repository.new.find!(metadata[:export_id])
    exporter_class = metadata[:exporter_class].constantize

    context = build_context(export)
    exporter = exporter_class.new(context)
    result = exporter.call

    # Upload the result
    uploaded = Exports::Uploader.upload(result.file)
    export.update(file_id: uploaded.id, filename: result.filename,
                  mime_type: result.mime_type, size: result.size)
  end

  private

  def build_context(export)
    # Build the hierarchical context chain
    Exports::Context.new(
      export:,
      dataset_context: DatasetContext.new(export.project_id),
      entry_context: EntryContext.new(export.project_id),
      annotation_context: AnnotationContext.new(export.project_id),
      media_context: MediaContext.new(export.project_id),
      io_context: IoContext.new
    )
  end
end
```

### Exports::Context Hierarchy

The exporter context provides a hierarchical API for reading project data and writing the output file.

```
Exports::Context            ← Top-level: export metadata, temp directory
  ├── DatasetContext        ← Dataset queries (projects, datasets, entries list)
  ├── EntryContext          ← Entry data (fields, metadata)
  ├── AnnotationContext     ← Annotations (shapes, labels, classifications)
  ├── MediaContext          ← Media access (download source files)
  └── IoContext             ← File I/O (temp files, compression)
```

Each context layer is a PORO (Plain Old Ruby Object) initialized with the relevant project/dataset IDs and backed by the inter-service API client to fetch data from other services.

```ruby
class Exports::Context
  attr_reader :export, :dataset, :entries, :annotations, :media, :io

  def initialize(export:, dataset_context:, entry_context:,
                 annotation_context:, media_context:, io_context:)
    @export = export
    @dataset = dataset_context
    @entries = entry_context
    @annotations = annotation_context
    @media = media_context
    @io = io_context
  end

  def temp_dir
    @io.temp_dir
  end
end
```

### Jobs::Scheduler / Jobs::Service / Jobs::Base

Standard job infrastructure — see [`guide/job-system.md`](guide/job-system.md) for full documentation. In the Sync Service:

- `Jobs::Scheduler` polls for pending `export`-type jobs
- `Jobs::Service` provides CRUD for job records
- `Jobs::Base` provides the `run` interface and status tracking

### Exports::Upd::Exporter

The default UPD format exporter, registered for all modalities (`/.*/`).

```ruby
class Exports::Upd::Exporter
  def initialize(context)
    @context = context
  end

  def self.format_name
    "upd"
  end

  def self.label
    "UPD Export"
  end

  def call
    # 1. Prepare temp directory via IoContext
    # 2. Query dataset entries via DatasetContext
    # 3. Fetch annotations via AnnotationContext
    # 4. Build UPD data structure
    # 5. Shell out to updcli-static binary for packaging
    # 6. Return Exports::Result with file path, filename, MIME type
  end
end
```

The UPD exporter uses the `updcli-static` binary (bundled with the service container) to compile the export into the UPD format.

### PluginLifecycleContext

The Sync Service exposes a `PluginLifecycleContext` that plugins use to register their exporters at boot time.

```ruby
class PluginLifecycleContext
  def register_exports(modality_regex, exporter_class)
    Exports::Registry.register(modality_regex, exporter_class)
  end

  def unmount_plugin(plugin_name)
    # Remove all exporters registered by this plugin
    Exports::Registry.remove_by_plugin(plugin_name)
  end
end
```

Plugins call this from their backend `init` method:

```ruby
# Inside plugin's backend module
def self.init(context)
  context.register_exports(/idah-video/, MyVideoExporter)
end
```

---

## Export Flow (Complete)

```
User                              Sync Service
────                              ───────────
POST /exports { project_id, dataset_id, format: "upd" }
                              → Exports::Service.create
                                → Exports::Registry.for("upd")
                                  → Exports::Upd::Exporter
                                → DB.transaction
                                  → Exports::Record created
                                  → Jobs::Record created
                              ← 202 Accepted (export + job links)

                              → Jobs::Scheduler picks up job
                                → Exports::Job#run
                                  → Build Context hierarchy
                                    → DatasetContext (API: dataset service)
                                    → EntryContext (API: dataset service)
                                    → AnnotationContext (API: dataset service)
                                    → MediaContext (API: media service)
                                    → IoContext (temp files)
                                  → Exports::Upd::Exporter#call
                                    → Collect data from context layers
                                    → Run updcli-static binary
                                    → Generate output file
                                  → Upload file via Shrine
                                  → Update Exports::Record (file_id, filename, size)
                                  → Mark Job completed

GET /exports/:id/download     → Stream file via Shrine
```

---

## DB Migrations

The Sync Service migration creates the `exports` table alongside the shared `jobs` table. The `uuid_generate_v7()` function is defined idempotently (same function as Media Service).

```ruby
Sequel.migration do
  up do
    create_table(:exports) do
      column :id, :uuid, default: Sequel.lit("uuid_generate_v7()"), primary_key: true
      foreign_key :job_id, :jobs, type: :uuid, null: true, on_delete: :set_null
      column :project_id, :uuid, null: false
      column :created_by_id, :uuid, null: false
      String :file_id
      String :filename
      String :mime_type
      Bignum :size

      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :project_id
      index :job_id
    end
  end

  down do
    drop_table(:exports)
  end
end
```

---

## Related Documentation

| Topic | Guide |
|-------|-------|
| Job system (Scheduler, Base, Service) | [`guide/job-system.md`](guide/job-system.md) |
| Plugin system & lifecycle contexts | [`guide/plugin-system.md`](guide/plugin-system.md) |
| Verse layered architecture | [`guide/verse-architecture.md`](guide/verse-architecture.md) |
| Exposition layer (HTTP + events) | [`guide/exposition-layer.md`](guide/exposition-layer.md) |
| Model & repository patterns | [`guide/model-repository.md`](guide/model-repository.md) |
| Media Service (Shrine storage) | [`guide/service-media.md`](guide/service-media.md) |
| Auth & authorization | [`guide/auth-authorization.md`](guide/auth-authorization.md) |
| Inter-service API client | [`guide/inter-service-api.md`](guide/inter-service-api.md) |
