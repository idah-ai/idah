# Plugin System

## Overview

The IDAH Plugin System allows extending the platform with new annotation modalities (e.g., video), media processors, export formats, and frontend UI components. Plugins are self-contained directories containing a `manifest.json` that describes their capabilities, entry points, and backend modules.

Each service defines its own `PluginLifecycleContext` that surfaces the specific registration APIs available to plugins within that service's domain. The core discovery and lifecycle machinery lives in `common/lib/plugin_system/` and is shared across all Ruby services.

---

## Manifest Structure

Every plugin **must** have a `manifest.json` at its root. This JSON file declares metadata, supported annotation modalities, entry points, and backend module configuration.

```json
{
  "type": "idah-plugin",
  "name": "idah-video",
  "version": "0.1.0",
  "title": "IDAH Video Annotation",
  "description": "Video annotation support",
  "modalities": [{
    "id": "idah-video",
    "label": "Video",
    "shapes": { "rectangle": { "label": "Rectangle" } }
  }],
  "entryPoints": {
    "entryPlugin": {
      "script": "frontend/dist/plugin.js",
      "style": "frontend/dist/plugin.css"
    },
    "entryDetails": {
      "script": "frontend/dist/details.js",
      "style": "frontend/dist/details.css"
    },
    "datasetConfig": "config/dataset.json",
    "pluginShortcut": "config/shortcut.json",
    "assetsDirectory": "assets",
    "backend": {
      "module": "IdahVideo",
      "path": "backends"
    }
  }
}
```

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `type` | `string` | Always `"idah-plugin"` |
| `name` | `string` | Unique plugin identifier (used as directory name convention) |
| `version` | `string` | Semantic version |
| `title` | `string` | Human-readable display name |
| `description` | `string` | Short description of plugin functionality |
| `modalities` | `array<object>` | Annotation modalities this plugin provides |
| `entryPoints` | `object` | Frontend and backend entry point configuration |

### Modality Objects

Each modality object describes an annotation mode:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique modality identifier (namespaced with plugin name) |
| `label` | `string` | Human-readable modality name |
| `shapes` | `object` | Map of shape types this modality supports |

### Entry Points

| Key | Type | Purpose |
|---|---|---|
| `entryPlugin.script` | `string` | Path (relative to plugin dir) to the plugin's main JS bundle |
| `entryPlugin.style` | `string` | Path to the plugin's CSS bundle |
| `entryDetails.script` | `string` | Path to JS for the entry-detail panel |
| `entryDetails.style` | `string` | Path to CSS for the entry-detail panel |
| `datasetConfig` | `string` | Path to dataset configuration JSON |
| `pluginShortcut` | `string` | Path to keyboard shortcut configuration JSON |
| `assetsDirectory` | `string` | Path to static assets directory |
| `backend` | `object` | Backend module configuration |

The `backend` object contains:

| Field | Type | Description |
|---|---|---|
| `module` | `string` | Ruby module name (e.g., `"IdahVideo"`) |
| `path` | `string` | Subdirectory containing service-specific backend code (e.g., `"backends"`) |

---

## Discovery & Loading

Plugin discovery and initialization follows a consistent pattern across all services.

### Initialization Flow

1. **Entry point** — Each service calls `PluginSystem.init(PluginLifecycleContext)` in one of its boot-time initializers (typically under `config/initializers/`).

2. **Filesystem scanning** — `PluginSystem.init` scans directories matched by `IDAH_PLUGIN_PATH` (environment variable). The default glob is `plugins/**`. Multiple paths can be separated by `;`.

3. **Manifest parsing** — For every directory containing a `manifest.json`, the system reads and validates the manifest, then creates a `Plugin` object.

4. **Registration** — Each valid `Plugin` is registered in the `Registry` and receives a call to `plugin.start(context_class)`.

```ruby
# Typical boot-time initializer
# config/initializers/plugin_system.rb

require "plugin_system"

PluginSystem.init(PluginLifecycleContext)
```

### Lifecycle Methods

| Method | Purpose |
|---|---|
| `PluginSystem.init(context_class)` | Scans plugins and starts them |
| `plugin.start(context_class)` | Boots a single plugin |
| `plugin.stop` | Tears down a plugin |
| `PluginSystem.restart_plugin(name, version)` | Stops + starts a plugin (used by restart mechanism) |

---

## Plugin.start()

When `plugin.start(context_class)` is called, the system performs the following steps:

### Step 1: Resolve backend path

The backend directory is constructed as:

```
<plugin_dir>/<backend.path>/<service_name>
```

For example, for the IAM service loading the `idah-video` plugin:

```
plugins/idah-video/backends/iam
```

### Step 2: Skip if absent

If the resolved backend directory does not exist on disk, the method returns early. This allows plugins to ship backend code only for the services they need. A video plugin, for instance, will have backend code for the **media** and **dataset** services, but likely not for **iam** or **audit**.

### Step 3: Zeitwerk setup

If the directory exists, a Zeitwerk loader is configured for it, enabling automatic file-to-module resolution (convention over configuration). This follows standard Ruby naming — a file at `backends/media/processor.rb` would define `IdahVideo::Media::Processor`.

### Step 4: Create lifecycle context

A service-specific `PluginLifecycleContext` is instantiated. This context object carries the plugin name and exposes registration APIs tailored to the service's responsibilities.

### Step 5: Call `init`

The system calls the main module's `init` method, passing the lifecycle context:

```ruby
IdahVideo::Media.init(@context)
```

This is where the plugin registers its processors, exports, stats generators, or other extensions with the hosting service.

---

## Service-Specific Lifecycle Contexts

Each service defines its own `PluginLifecycleContext` class that surfaces only the registration methods relevant to that service. This enforces domain boundaries and keeps plugin APIs explicit.

### Media Service

The media service's context allows plugins to register **media processors** — classes that handle encoding, analysis, or transformation of media files.

```ruby
class PluginLifecycleContext
  def register_processor(name, class_name:, options_class_name: "Schema::Empty")
    Processor::Registry.register(@plugin_name, name, class_name:, options_class_name:)
  end

  def unmount_plugin
    Processor::Registry.clear(@plugin_name)
  end
end
```

- `register_processor` — Associates a processor name with a Ruby class. An optional options schema class defines configurable parameters exposed to the frontend or job system.
- `unmount_plugin` — Removes all processors registered by this plugin, called during plugin stop.

### Sync Service

The sync service's context allows plugins to register **export generators** — classes that produce exported files in specific formats.

```ruby
class PluginLifecycleContext
  def register_exports(modalities, klass)
    Exports::Registry.register(@plugin_name, modalities, klass)
  end

  def unmount_plugin
    Exports::Registry.clear(@plugin_name)
  end
end
```

- `register_exports` — Binds a set of modality identifiers to an export class. When a user exports data in one of the listed modalities, the registered class is invoked.
- `unmount_plugin` — Removes all exports registered by the plugin.

### Dataset Service

The dataset service's context allows plugins to register **stats generators** — classes that compute entry-level statistics for entries of a given modality.

```ruby
class PluginLifecycleContext
  def register_stats_generator(modality, klass)
    EntryStats::Registry.register(@plugin_name, modality, klass)
  end

  def unmount_plugin
    EntryStats::Registry.clear(@plugin_name)
  end
end
```

- `register_stats_generator` — Associates a modality ID with a stats generator class. Stats appear on the entry detail view and are used in dataset dashboards.
- `unmount_plugin` — Removes all stats generators registered by the plugin.

### Setting Service

The setting service's lifecycle context is a no-op. It does not expose any registration methods because the setting service is purely a registry for plugin metadata (manifest data, modalities, assets) rather than a host for runtime functionality.

```ruby
class PluginLifecycleContext
  # No registration methods — the Setting service
  # manages plugin metadata through its HTTP API.
end
```

Instead of backend registrations, plugins expose their configuration through the Setting Service HTTP endpoints (see below).

---

## Setting Service HTTP Endpoints

The Setting Service exposes several HTTP endpoints that the frontend and other services use to query plugin metadata and serve plugin assets. All responses follow JSON:API format.

### List Modalities

```
GET /plugins/modalities
```

Returns all modalities across all plugins, mapped to their owning plugin names. The frontend uses this to populate the annotation mode selector.

### Modality Shapes

```
GET /plugins/modalities/:name
```

Returns the available shape types for a specific modality (identified by its `name` parameter). Each shape includes a label and any shape-specific configuration.

### Plugin Assets

```
GET /plugins/:plugin/assets/*
```

Serves static asset files for a plugin (from the `assetsDirectory` declared in the manifest). This is a wildcard route — anything after `/assets/` is resolved relative to the plugin's assets directory. Used for icons, thumbnails, and other static resources.

### Plugin Entry Files

```
GET /plugins/:plugin/files/:filename
```

Serves entry files declared in the manifest, such as `plugin.js`, `plugin.css`, `details.js`, and `details.css`. The frontend loads these files dynamically when activating a plugin in the annotation workspace.

---

## Frontend Integration

### IdahPlugin.svelte

The frontend mounts plugin UI through a dedicated Svelte component, `IdahPlugin.svelte`, which is activated in the annotation workspace at the route `/entries/[id]/plugin/[pluginId]`.

**Mount sequence:**

1. **Check global** — The component checks for the existence of `window.idah_plugin`, the global object injected by the plugin's JS bundle.

2. **`init(driver.sealed())`** — The `init` method is called with a sealed (immutable proxy) version of the driver. Sealing prevents the plugin from mutating internal state, ensuring a clean public API boundary.

3. **`render(container)`** — The `render` method is called with an `HTMLElement` that the plugin should mount into. The plugin is responsible for rendering its full UI within this container.

4. **`close()`** — On component destruction (navigation away, plugin change, or unmount), `close()` is called to allow the plugin to clean up event listeners, timers, and DOM mutations.

### Plugin Interface (IPluginDriver)

Every frontend plugin must implement the following interface:

```typescript
interface IPluginDriver {
  get name(): string;
  init(driver: IIdahDriverV2): void;
  render(parent: HTMLElement): void;
  close(): void;
}
```

| Method | Purpose |
|---|---|
| `name` | Getter returning the plugin identifier |
| `init(driver)` | Initialization — receive the sealed driver, set up state |
| `render(parent)` | Render the plugin UI into the provided DOM element |
| `close()` | Teardown — release resources, remove event listeners |

### Driver API (IIdahDriverV2)

The driver is the bridge between the plugin and the core IDAH platform. It provides context, lifecycle hooks, and sub-module access.

```typescript
interface IIdahDriverV2 {
  // --- Context ---
  id: string;                    // Current entry ID
  dataset: object;               // Current dataset info
  project: object;               // Current project info
  media: object;                 // Current media metadata
  workflowStep: object;          // Current workflow step
  mode: string;                  // Current annotation mode
  config: object;                // Plugin-specific configuration

  // --- Lifecycle ---
  setMode(mode: string): void;
  onModeChange(callback: (mode: string) => void): void;
  onReady(callback: () => void): void;
  onSyncChange(callback: (syncing: boolean) => void): void;
  onSyncError(callback: (error: Error) => void): void;

  // --- Sub-modules ---
  command: ICommandModule;
  toolbar: IToolbarModule;
  annotations: IAnnotationModule;
  notes: INotesModule;
  stats: IStatsModule;
}
```

#### Sub-modules Overview

| Module | Purpose |
|---|---|
| `command` | Execute platform commands (save, undo, redo, navigate) |
| `toolbar` | Register custom toolbar items and tool groups |
| `annotations` | CRUD operations for annotations — these use IndexedDB for local-first storage with background sync to the backend |
| `notes` | Read/write entry-level notes |
| `stats` | Read entry statistics (updated by the stats generators on the dataset service) |

### IndexedDB & Sync

Annotations are stored locally in IndexedDB before being synced to the backend. This provides a local-first experience — annotations are immediately visible after creation and persist even when offline. The sync layer:

- Batches unsaved annotations and pushes them to the annotation JSON-RPC endpoint (`/annotations/_rpc`, batch limit: 50)
- Pulls updates from the server to reconcile concurrent edits
- Reports sync status through `onSyncChange` and errors through `onSyncError`

### The Sealed Driver

`driver.sealed()` returns a **readonly proxy** wrapping the public API surface. The sealed driver:

- Prevents assignment to properties (`setMode`, etc. remain callable functions but the context properties like `id`, `dataset` become read-only)
- Hides any internal methods or state not part of the `IIdahDriverV2` interface
- Throws in strict mode if the plugin attempts to mutate the driver

This ensures plugins interact with the platform through a well-defined API and cannot accidentally (or deliberately) corrupt platform state.

---

## Restart Mechanism

When plugin configuration changes (e.g., a new version is installed, or a plugin is enabled/disabled), the system needs to reload the affected plugins without restarting the entire service.

### Flow

1. **Setting Service emits event** — The Setting Service publishes a `setting:plugins:restart_required` event through the event system.

2. **Exposition subscribes** — `PluginSystem::Exposition` listens for the `setting:plugins:restart_required` event.

3. **Trigger restart** — On receiving the event, the exposition calls `PluginSystem.restart_plugin(name, version)`.

4. **Stop + Start** — `PluginSystem.restart_plugin` calls `plugin.stop` followed by `plugin.start(context_class)`:

   - **`plugin.stop`** — Calls `context.unmount_plugin` (which clears the plugin's registrations from the relevant registries), tears down the Zeitwerk loader, and runs any plugin-specific cleanup.
   - **`plugin.start`** — Re-runs the full initialization sequence (path resolution, Zeitwerk setup, context creation, `init` call) as described in the [Plugin.start()](#pluginstart) section.

```ruby
# Simplified restart_plugin implementation
def self.restart_plugin(name, version)
  plugin = Registry.find(name, version)
  return unless plugin

  plugin.stop   # unmount registrations, tear down loader
  plugin.start  # re-discover, re-register, re-init
end
```

This restart is scoped to the specific plugin — other plugins continue running unaffected.

---

## Plugin Directory Structure

A complete plugin project follows this convention:

```
plugins/idah-video/
├── manifest.json
├── backends/
│   ├── media/
│   │   ├── processor.rb
│   │   └── ...
│   ├── dataset/
│   │   ├── stats_generator.rb
│   │   └── ...
│   └── sync/
│       ├── export.rb
│       └── ...
├── frontend/dist/
│   ├── plugin.js
│   ├── plugin.css
│   ├── details.js
│   └── details.css
├── config/
│   ├── dataset.json
│   └── shortcut.json
└── assets/
    ├── icon.svg
    └── ...
```

Not all backend subdirectories need to be present — only those relevant to the services the plugin extends.

---

## Summary

| Aspect | Detail |
|---|---|
| **Discovery** | Filesystem glob via `IDAH_PLUGIN_PATH` env var (default `plugins/**`) |
| **Configuration** | `manifest.json` at plugin root |
| **Backend lifecycle** | `Plugin.start` → resolve path → Zeitwerk → context → `init` |
| **Service contexts** | Media (processors), Sync (exports), Dataset (stats), Setting (no-op) |
| **Frontend interface** | `IPluginDriver` with `init`, `render`, `close` |
| **Driver API** | Context, lifecycle hooks, sub-modules (command, toolbar, annotations, notes, stats) |
| **Data storage** | IndexedDB local-first with background sync to backend JSON-RPC |
| **Restart** | Event-driven via `setting:plugins:restart_required` → `stop` + `start` |
