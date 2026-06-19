# Setting Service

## Overview

The Setting Service manages **three distinct concerns**:

1. **Global settings** — key-value configuration shared across the entire IDAH deployment
2. **Per-account settings** — user-specific preferences (notification flags, UI preferences, etc.)
3. **Plugin management** — discovering plugins, exposing modalities and shapes, and serving plugin assets (JS, CSS, images)

The service is the central registry for plugin metadata consumed by the frontend and other backend services (Media, Dataset, Sync) during boot.

---

## Models

### Setting::Record

Global application settings stored in the `settings` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `key` | `text` | Setting key (unique, snake_case) |
| `value` | `text` | Setting value (JSON-encoded for complex values) |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

```ruby
class Setting::Record < Sequel::Model(:settings)
  include Verse::Model

  plugin :timestamps, update_on_create: true
end
```

### AccountSetting::Record

Per-account preferences stored in the `account_settings` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `account_id` | `uuid` | Foreign key to the account |
| `key` | `text` | Setting key (e.g. `notification_account_created`) |
| `plugin` | `text` | Optional plugin namespace (for plugin-specific settings) |
| `value` | `text` | Setting value |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

```ruby
class AccountSetting::Record < Sequel::Model(:account_settings)
  include Verse::Model

  plugin :timestamps, update_on_create: true
end
```

The uniqueness constraint is on `(account_id, key, plugin)` — an account can have one value per key per plugin namespace, and the `plugin` field being `nil` denotes a core (non-plugin) setting.

### Plugin::Record

Plugin metadata stored in the `plugins` table.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Primary key (UUIDv7) |
| `source_type` | `text` | Where the plugin was loaded from (e.g. `filesystem`, `url`) |
| `source_path` | `text` | Absolute path to the plugin directory on disk |
| `name` | `text` | Unique plugin name (from `manifest.json`) |
| `description` | `text` | Plugin description |
| `version` | `text` | Plugin version |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

```ruby
class Plugin::Record < Sequel::Model(:plugins)
  include Verse::Model

  plugin :timestamps, update_on_create: true
end
```

---

## Endpoints

### HTTP — `/settings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings` | Admin | List all global settings |
| `GET` | `/settings/:id` | Admin | Show a single setting |
| `PATCH` | `/settings/:id` | Admin | Update a setting value |

### HTTP — `/account_settings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/account_settings` | Authenticated | List account settings (scoped to current account) |
| `GET` | `/account_settings/:id` | Authenticated | Show a single account setting |
| `PATCH` | `/account_settings/:id` | Authenticated | Update an account setting |

### HTTP — `/plugins`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/plugins/modalities` | Authenticated | List all available annotation modalities |
| `GET` | `/plugins/modalities/:name` | Authenticated | Show modality details (shapes, metadata) |
| `GET` | `/plugins/:plugin/assets/*` | Public | Serve plugin static assets (images, config JSON) |
| `GET` | `/plugins/:plugin/files/:filename` | Public | Serve plugin entry files (JS, CSS bundles) |

#### Modalities Endpoint

```
GET /plugins/modalities
→ [{ id: "idah-video", label: "Video", shapes: { rectangle: { label: "Rectangle" } } }, ...]
```

This endpoint aggregates modalities from all loaded plugins, merging them into a unified list consumed by the frontend's annotation mode selector.

#### Plugin Asset Serving

```
GET /plugins/:plugin/assets/*path
  → Reads file from <plugin_dir>/<assetsDirectory>/<path>
  → Returns with correct MIME type
  → Caching: ETag + Last-Modified headers

GET /plugins/:plugin/files/:filename
  → Reads file from <plugin_dir>/<filename>
  → Used for entryPlugin.script/style and entryDetails.script/style
```

Asset serving is used by the frontend to load plugin entry points:

```html
<script src="/plugins/idah-video/files/plugin.js"></script>
<link rel="stylesheet" href="/plugins/idah-video/files/plugin.css" />
```

### Events

| Event | Direction | Trigger | Description |
|-------|-----------|---------|-------------|
| `iam:accounts:created` | **Subscribed** | IAM Service | Create default account settings for new accounts |
| `iam:accounts:deleted` | **Subscribed** | IAM Service | Clean up account settings when an account is deleted |

---

## Key Services

### Settings::Service

Global settings CRUD.

```ruby
class Settings::Service < Verse::Service::Base
  use_repository Setting::Repository

  def index(pagination:, filters: {})
    repository.index(pagination:, filters:)
  end

  def show(id)
    repository.find!(id)
  end

  def update(id, attributes)
    repository.update!(id, attributes)
  end
end
```

### AccountSettings::Service

Per-account settings CRUD with automatic defaults creation.

```ruby
class AccountSettings::Service < Verse::Service::Base
  use_repository AccountSetting::Repository

  DEFAULTS = {
    "notification_account_created" => "true",
    "notification_project_member_added" => "true",
    "notification_project_member_removed" => "true",
    "notification_dataset_completed" => "true",
    "notification_org_owner_role_assigned" => "true",
    "notification_org_owner_role_removed" => "true"
  }.freeze

  def index(account_id:, pagination:, filters: {})
    filters[:account_id] = account_id
    repository.index(pagination:, filters:)
  end

  def show(id)
    repository.find!(id)
  end

  def update(id, attributes)
    repository.update!(id, attributes)
  end

  # Called on iam:accounts:created event
  def create_default_settings(account_id:)
    DEFAULTS.each do |key, value|
      repository.create!(
        account_id:,
        key:,
        value:,
        plugin: nil
      )
    rescue Sequel::UniqueConstraintViolation
      # Already exists — skip
    end
  end

  # Called on iam:accounts:deleted event
  def cleanup_account_settings(account_id:)
    repository.delete_all(account_id:)
  end
end
```

Default notification preferences all start as `"true"`. Users can opt out of individual notification categories via the frontend settings UI (which calls `PATCH /account_settings/:id`).

### Plugins::Service

Provides plugin metadata queries and asset serving.

```ruby
class Plugins::Service < Verse::Service::Base
  # List all modalities from all loaded plugins
  def modalities
    PluginSystem.plugins.flat_map do |plugin|
      next [] unless plugin.loaded?

      plugin.manifest["modalities"].map do |mod|
        {
          id: mod["id"],
          label: mod["label"],
          shapes: mod["shapes"],
          plugin: plugin.name
        }
      end
    end
  end

  # Show a single modality with full shape details
  def show_modality(modality_id)
    modalities.find { |m| m[:id] == modality_id }
  end

  # Serve a static asset file from a plugin
  def serve_asset(plugin_name, asset_path)
    plugin = PluginSystem.find!(plugin_name)
    assets_dir = plugin.manifest.dig("entryPoints", "assetsDirectory") || "assets"
    full_path = File.join(plugin.path, assets_dir, asset_path)
    serve_file(full_path)
  end

  # Serve an entry file (JS, CSS) from a plugin
  def serve_file(plugin_name, filename)
    plugin = PluginSystem.find!(plugin_name)
    full_path = File.join(plugin.path, filename)
    serve_file(full_path)
  end

  private

  def serve_file(full_path)
    raise Verse::Error::RecordNotFound, "File not found" unless File.exist?(full_path)

    content = File.read(full_path)
    mime_type = MIME::Types.type_for(full_path).first&.content_type || "application/octet-stream"
    [content, mime_type]
  end
end
```

### Plugins::Manager

Background queue for plugin lifecycle operations (install, uninstall, restart).

```ruby
class Plugins::Manager
  def initialize
    @queue = Queue.new
    @worker = Thread.new { process_queue }
  end

  def enqueue(action, plugin_name)
    @queue << { action:, plugin_name: }
  end

  private

  def process_queue
    loop do
      task = @queue.pop
      case task[:action]
      when :restart
        PluginSystem.restart_plugin(task[:plugin_name])
      when :uninstall
        PluginSystem.unload_plugin(task[:plugin_name])
      end
    end
  end
end
```

The manager uses a thread-safe `Queue` to serialize plugin operations, avoiding race conditions during reload.

---

## Plugin Integration

The Setting Service is tightly coupled with the plugin system. At boot time:

1. `PluginSystem.init(PluginLifecycleContext)` scans `IDAH_PLUGIN_PATH`
2. Each plugin's manifest is loaded and its `Plugin::Record` is upserted
3. Plugin modalities are registered for discovery via the `/plugins/modalities` endpoint
4. Plugin assets and entry files are served via the `/plugins/:plugin/*` endpoints

### PluginLifecycleContext

```ruby
class PluginLifecycleContext
  def initialize
    @plugins = []
  end

  def register_plugin(plugin)
    @plugins << plugin
    Plugins::Repository.new.create_or_update(
      name: plugin.name,
      source_type: "filesystem",
      source_path: plugin.path,
      description: plugin.manifest["description"],
      version: plugin.manifest["version"]
    )
  end

  def unmount_plugin(plugin_name)
    Plugins::Repository.new.delete_by_name(plugin_name)
    @plugins.reject! { |p| p.name == plugin_name }
  end
end
```

---

## Event Handlers

### Account Created → Create Default Settings

```ruby
class AccountSettingsEventsExpo < BaseExpo
  expose on_resource_event(Resource::Iam::Accounts, "created")
  def on_account_created
    account_id = message.content[:resource_id]
    service.create_default_settings(account_id:)
  end
end
```

### Account Deleted → Cleanup Settings

```ruby
class AccountSettingsCleanupExpo < BaseExpo
  expose on_resource_event(Resource::Iam::Accounts, "deleted")
  def on_account_deleted
    account_id = message.content[:resource_id]
    service.cleanup_account_settings(account_id:)
  end
end
```

---

## DB Migrations

```ruby
Sequel.migration do
  up do
    create_table(:settings) do
      column :id, :uuid, default: Sequel.lit("uuid_generate_v7()"), primary_key: true
      String :key, null: false, unique: true
      String :value, null: false, text: true

      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP
    end

    create_table(:account_settings) do
      column :id, :uuid, default: Sequel.lit("uuid_generate_v7()"), primary_key: true
      column :account_id, :uuid, null: false
      String :key, null: false
      String :plugin
      String :value, null: false, text: true

      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP

      unique [:account_id, :key, :plugin]
      index :account_id
    end

    create_table(:plugins) do
      column :id, :uuid, default: Sequel.lit("uuid_generate_v7()"), primary_key: true
      String :source_type, null: false
      String :source_path, null: false, text: true
      String :name, null: false, unique: true
      String :description, text: true
      String :version

      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP
    end
  end

  down do
    drop_table(:settings)
    drop_table(:account_settings)
    drop_table(:plugins)
  end
end
```

---

## Architecture Diagram

```
IAM Service                   Setting Service
───────────                   ───────────────
accounts:created ──────┐
accounts:deleted ──────┤
                       ▼
               ┌───────────────────┐
               │ Event Handlers    │
               │  → create defaults│
               │  → cleanup        │
               └───────┬───────────┘
                       │
               ┌───────▼───────────┐
               │ AccountSettings   │
               │ ::Service         │
               │   (CRUD +         │
               │    defaults)      │
               └───────┬───────────┘
                       │
               ┌───────▼───────────┐  ┌─────────────────────┐
               │ Settings::Service │  │ Plugins::Service    │
               │   (global CRUD)   │  │   (modalities,      │
               └───────────────────┘  │    assets, files)   │
                                       └─────────┬───────────┘
                                                 │
                                       ┌─────────▼───────────┐
                                       │ PluginSystem.init   │
                                       │   (scans IDAH_PLUGIN│
                                       │    _PATH)           │
                                       └─────────────────────┘

Frontend
───────
GET /plugins/modalities           ← discover annotation modes
GET /plugins/:plugin/files/*      ← load plugin JS/CSS
GET /plugins/:plugin/assets/*     ← load plugin images/config
PATCH /account_settings/:id       ← update user preferences
```

---

## Related Documentation

| Topic | Guide |
|-------|-------|
| Plugin system (discovery, lifecycle, manifests) | [`guide/plugin-system.md`](guide/plugin-system.md) |
| Verse layered architecture | [`guide/verse-architecture.md`](guide/verse-architecture.md) |
| Exposition layer (HTTP + events) | [`guide/exposition-layer.md`](guide/exposition-layer.md) |
| Model & repository patterns | [`guide/model-repository.md`](guide/model-repository.md) |
| Auth & authorization | [`guide/auth-authorization.md`](guide/auth-authorization.md) |
| Inter-service API client | [`guide/inter-service-api.md`](guide/inter-service-api.md) |
| Notification Service (reads account settings) | [`guide/service-notification.md`](guide/service-notification.md) |
