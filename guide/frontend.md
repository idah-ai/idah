# Frontend (SvelteKit)

## Overview

The IDAH frontend is a **SvelteKit 5** single-page application that provides the user interface for the Ingedata Annotation Hub. It communicates with backend services via JSON:API HTTP endpoints and JSON-RPC batch endpoints, and hosts third-party annotation plugins in a sandboxed driver environment.

The frontend lives at `app/frontend/` and is built as a standalone Docker container (served via the SvelteKit Node adapter).

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **SvelteKit 5** | Meta-framework — routing, SSR, layout system |
| **Svelte 5** | Component model — runes (`$state`, `$derived`, `$effect`, `$props`) and snippets (`#snippet`, `{@render}`) |
| **TypeScript** | Typed throughout — no plain JS in components or data layer |
| **Tailwind CSS 4** | Utility-first CSS with `@import "tailwindcss"` syntax, `@theme` tokens, `@custom-variant dark` |
| **bits-ui** | Headless UI primitives (shadcn-svelte foundation) — Dialog, Popover, DropdownMenu, Command, etc. |
| **Vite** | Build tool, dev server, vitest runner |

### Key Dependencies

| Package | Role |
|---------|------|
| `@lucide/svelte` | Icon component library |
| `mode-watcher` | Dark/light mode toggling (`<ModeWatcher />`) |
| `svelte-sonner` | Toast notifications (`<Toaster />`) |
| `@tanstack/table-core` | Headless table state for `DatasourceTable` |
| `tailwind-merge`, `tailwind-variants`, `clsx` | Tailwind class merging utilities |
| `tw-animate-css` | CSS animation utilities |
| `zod` | Schema validation |
| `uuidv7` | RFC 9562 UUID v7 generation |
| `date-fns` | Date formatting |
| `marked` | Markdown rendering |
| `peggy` | Parser generator (used for AST-based label config filtering) |
| `vaul-svelte` | Drawer component (from vaul) |
| `paneforge` | Resizable panels |

---

## Route Structure

Routes are organized into three layout groups under `src/routes/`:

```
src/routes/
├── +layout.svelte                  # Root layout — ModeWatcher, Toaster, base CSS
├── (auth)/
│   ├── +layout.svelte              # Auth layout — centered card, no sidebar
│   ├── login/
│   ├── forgot-password/
│   └── reset-password/
├── (public)/
│   ├── accept-invitation/
│   └── error/
└── (protected)/
    ├── +layout.svelte              # AuthenticationStatus wrapper
    └── (app)/
        ├── +layout.svelte          # App layout — sidebar, nav
        ├── +page.svelte            # Redirects to /projects
        ├── accounts/               # Admin: account management
        ├── api-keys/               # API key management
        ├── audit-logs/             # Audit trail
        ├── organizations/          # Organization list
        │   └── [id]/
        │       ├── projects/       # Projects within org
        │       └── owners/         # Org owner management
        ├── projects/               # Project list
        │   └── [id]/
        │       ├── datasets/
        │       │   └── [id]/
        │       │       ├── analytics/
        │       │       ├── entries/    # Entry list (table)
        │       │       └── labels/     # Label configuration
        │       ├── exports/        # Export job management
        │       └── members/        # Project member management
        ├── settings/
        │   ├── appearance/
        │   ├── notifications/
        │   └── security/
        └── entries/
            └── [entryId]/
                └── plugin/
                    └── [pluginId]/     # Annotation workspace
```

### Layout Hierarchy

```
+layout.svelte (root)
├── (auth)/+layout.svelte          → Login, forgot/reset password
├── (public)/+layout.svelte        → Accept invitation, error pages
└── (protected)/+layout.svelte     → auth check via AuthenticationStatus
    └── (app)/+layout.svelte       → sidebar, app chrome (ApplicationHeader)
```

### Route Patterns

- **Auth pages** (`(auth)`): Centered card layout, no navigation chrome. Used for login, password reset flows.
- **Public pages** (`(public)`): Minimal layout for invitation acceptance and error displays.
- **Protected pages** (`(protected)/(app)`): Full app chrome with sidebar navigation, application header, and authorization scoping via `PageProvider`.

---

## Data Layer (`src/lib/data/`)

### BackendDataSource

The `createBackendDataSource<T>(recordClass, basePath, customMethods?)` factory function creates a `DataSource<T>` object with five standard CRUD methods that communicate with the backend via JSON:API over `fetch()`.

#### Standard Methods

| Method | HTTP | Description |
|--------|------|-------------|
| `create(data, opts?)` | POST `basePath` | Creates a resource. Clears list cache. Content-Type: `application/vnd.api+json` |
| `get(id, opts?)` | GET `basePath/{id}` | Fetches single resource. Cached per `{basePath}/{id}` + query signature. Supports `included`, `fields`, `noCache` |
| `list(opts?)` | GET `basePath` | Fetches collection with filter/fields/sort/page params. Cached per query signature. `all: true` for recursive pagination via `links.next` |
| `update(id, data, opts?)` | PATCH `basePath/{id}` | Updates resource. Clears list + item caches |
| `delete(id, opts?)` | DELETE `basePath/{id}` | Deletes resource. Clears caches. Returns `true` |

#### Custom Methods

The third argument to `createBackendDataSource` allows extending the data source with domain-specific methods. For example, entries add `select`, `assign`, and `submit`:

```typescript
export const entriesBackendDataSource = createBackendDataSource(EntryRecord, entriesBasePath, {
  select: async (params: { id: string }) => { ... },
  assign: async (params: { id: string; memberAccountId: number }) => { ... },
  submit: async (entryId: string, opts?: { approved: boolean }) => { ... },
});
```

Custom methods are merged via `Object.assign` into the returned object.

#### Payload Encoding

The `encodeModel` helper converts a `Record` subclass instance into a JSON:API request body:

1. Iterates over `recordClass.fields` (populated by `@field` decorators)
2. Applies the `transformer.to` function (defaults to identity) for snake_case → server-expected format
3. Injects `data.type` from the class-level `@type` decorator
4. Includes `data.id` from `attributes.id` if present (for updates)
5. Includes `data.relationships` from the `data.relationships` parameter

```typescript
// Resulting POST body example:
{
  "data": {
    "type": "dataset:entries",
    "attributes": {
      "project-id": "abc-123",
      "dataset-id": "def-456",
      "name": "My Entry"
    }
  }
}
```

#### Error Handling

When a response contains `body.errors`, each error is displayed via `showErrorToast({ title: err.title, message: err.detail, error: err })`, and the promise is rejected with a parsed `JsonApiErrorResponse`.

---

### Record Decorator Pattern

Record subclasses use TypeScript decorators to map JSON:API responses to typed class instances.

#### `@type(typeString)` — Class-Level Decorator

Sets the static `type` property on the Record class, which serves as both the JSON:API `data.type` identifier and the key registered in `RecordFactory.typeMap`.

```typescript
@type("dataset:entries")
export class EntryRecord extends Record { ... }
```

#### `@field(opts?)` — Property Decorator

Maps a JSON:API attribute (snake_case in the backend) to a camelCase class property. Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | Property name | Override JSON:API attribute key (for snake_case mapping) |
| `transformer` | `{ from, to }` | `{ from: identity }` | Transform values between API and UI representations |

```typescript
@field({ key: "project-name", transformer: Transformers.Time })
public readonly projectName!: Date;
```

Built-in transformers (in `transformers.ts`):
- `Transformers.Time` — ISO string ↔ `Date` object
- `Transformers.Date` — `yyyy-MM-dd` string ↔ `Date` object (time truncated to midnight)

#### `@relationship(opts?)` — Property Decorator

Resolves a related resource from the JSON:API `included` array. Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | Property name | Override relationship key in the response |

```typescript
@relationship() public dataset!: DatasetRecord;
@relationship() public assigned_to!: ProjectMemberRecord;
```

The relationship decorator:
1. Looks up the relationship in `model.relationships[key]`
2. Handles both single (`JsonApiReference`) and array (`JsonApiReference[]`) relationships
3. Finds the related object in the `IncludeList` by type + id
4. Creates the correct Record subclass via `RecordFactory.create`
5. Caches the result in `_relationshipCached[key]`

#### RecordFactory

A static registry that maps JSON:API type strings to Record subclasses:

```typescript
RecordFactory.registerTypes(EntryRecord, DatasetRecord, ProjectRecord);
// or one at a time:
RecordFactory.registerType(EntryRecord);

// Instantiate from raw JSON:API data:
const entry = RecordFactory.create<EntryRecord>(jsonApiData, includeList);
```

The factory is used internally by `parseSingleElementReturn` and `parseCollectionReturn` in `json_api.ts`.

#### IncludeList / IncludeSet

- **`IncludeList`** — Parses the JSON:API `included` array into a nested index (`{ type → { id → record } }`). Used by `@relationship` to resolve related records.
- **`IncludeSet`** — Used by `MemoryDataSource` for in-memory relationship resolution, tracking which records are included for each model type + relation.

---

### JSON-RPC Batch Client (`JsonRpcDatasource`)

Used for annotation mutations in the annotation workspace. Located in `src/lib/data/jsonrpc.ts`.

#### Architecture

```
call(method) ──→ queue[QueueItem] ──→ flush() ──→ process_batch(batch)
                        ↑                              │
                        └──── failure.re-enqueue ───────┘
```

#### Key Characteristics

| Feature | Behavior |
|---------|----------|
| **Batch size** | Configurable (default: 50). Flushes when queue reaches batch size |
| **Single-item optimization** | Sends bare object (not array) when only 1 request is batched |
| **JSON-RPC format** | Full `jsonrpc: "2.0"` with sequential integer `id` fields |
| **Network errors** | Exponential backoff: 1s → 2s → 4s … capped at 30s. Uses `setTimeout` retry |
| **Server errors** | Pauses queue and fires `errorObserver`. Caller must explicitly call `resume()` |
| **Error observer** | `setErrorObserver(fn)` — receives `ISyncErrorEvent` with message, code, failedCount |

#### Usage

```typescript
const rpc = new JsonRpcDatasource(`${HOST}/api/v1/dataset/annotations/_rpc`);

rpc.setErrorObserver((err) => {
  console.error("RPC error:", err.message);
});

const result = await rpc.call({
  method: "annotation.create",
  params: { entry_id: "abc", shape: { ... }, value: { ... } },
});
```

---

### Cache (`src/lib/data/Cache.ts`)

An in-memory cache with **3-minute TTL** and automatic expiration cleanup every 10 seconds.

| Function | Description |
|----------|-------------|
| `setCache(key, signature, value, expireInMin?)` | Stores value keyed by `{cacheKey}-{cacheSignature}`. Default TTL: 3 min |
| `getCache(key, signature)` | Returns cached value or `undefined` |
| `clearCache(key, signature?)` | With signature: clears single entry. Without: clears all entries matching `^{cacheKey}-` regex |
| `clearAllCache()` | Empties entire cache. Called on logout |

The cache uses a simple object store (`cacheList: { [key: string]: CacheData }`) and a 10-second interval timer that evicts expired entries.

#### Cache Strategy in BackendDataSource

| Operation | Cache Behavior |
|-----------|---------------|
| `get(id)` | Cached per `{basePath}/{id} + querySignature`. Bypassed with `noCache: true` |
| `list(opts)` | Cached per `{basePath} + querySignature`. Bypassed with `noCache: true` |
| `create(...)` | Clears `{basePath}` list cache |
| `update(id, ...)` | Clears both `{basePath}` list and `{basePath}/{id}` item caches |
| `delete(id)` | Clears both caches |

---

### MemoryDataSource (`src/lib/data/MemoryDataSource.ts`)

An in-memory implementation of the `DataSource<T>` interface, used exclusively for **testing**. Supports the full CRUD API plus:

- **Filters**: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `nin`, `contains`, `ncontains`, `null`, `nnull`, `match` (regex)
- **Sort**: Single field with `-` prefix for descending
- **Pagination**: `page` + `itemsPerPage`
- **Relations**: `belongsTo`, `hasMany`, `hasOne` — resolves included relationships from foreign data sources
- **Configurable delay**: Simulates network latency
- **Error simulation**: Pass `error: true` in options

```typescript
const ds = createMemoryDataSource(EntryRecord, {
  initialData: [ { id: "1", name: "Test" } ],
  delay: 50, // 50ms simulated delay
  relations: {
    dataset: belongsTo(datasetDs, "dataset_id"),
  },
});
```

---

## State Management

### AuthContext (`src/lib/security/AuthContext.ts`)

A singleton auth context that manages the entire authentication lifecycle via a Svelte writable store.

#### `authStatus` Store

```typescript
export const authStatus: Writable<AuthenticationStatus> = writable({
  status: "loading",  // "loading" | "logged-in" | "logged-out"
  authContext: null,
});
```

Accessed in templates via the `$authStatus` store auto-subscription.

#### AuthContext Class

| Method | Description |
|--------|-------------|
| `signInWithEmailAndPassword(email, password)` | POSTs credentials, creates `AuthContext` from `AccountAuthRecord`, sets status to "logged-in" |
| `refresh()` | Refreshes session on page load, restores `AuthContext` |
| `logout()` | Calls `signOut`, clears all caches, redirects to `/login` |

#### Authorization Methods

| Method | Description |
|--------|-------------|
| `can(action, resource, scopes?)` | Async check against role rights (ActionMap trie) + optional `as_user` project member scope |
| `hasScope(action, resource, scope?)` | Sync check against the ActionMap (no project membership lookup) |
| `isRole(roleToCheck)` | Compares `roleName` to a specific role constant |

#### `as_user` Scope

When the `scopes` array contains an `{ as_user: { projectId, projectMemberRoles } }` object, `can()` fetches the current account's `ProjectMember` record for the given project and checks if their role is in the allowed list. This enables project-level authorization beyond global role-based permissions.

#### ActionMap (`src/lib/security/ActionMap.ts`)

A trie-based permission lookup that parses raw action strings in the format `resource.action.scope`:

```typescript
// Input: ["dataset:entries.create.*", "dataset:entries.read.*"]
// Internal map: { "dataset:entries": { "create": ["*"], "read": ["*"] } }

// Fallback: if a resource is not found, checks for "*.*.*" (admin wildcard)
// Fallback: if an action is not found, tries "*" action on the resource
```

### `can.svelte` — Svelte Component Wrapper

A renderless component that gates content by authorization:

```svelte
<Can action="read" resource="dataset:projects" scopes={[{ as_user: { projectId, projectMemberRoles: ["annotator"] } }]}>
  {#snippet children()}
    <ProtectedContent />
  {/snippet}
  {#snippet noAccess()}
    <p>Access denied</p>
  {/snippet}
</Can>
```

### `refetches` Store (`src/lib/utils/refetch.ts`)

A writable store containing `Date` timestamps for each resource type. Incremented on write operations to trigger data reloads via Svelte `{#key}` blocks in templates.

```typescript
export const refetches = writable<Refetches>({
  projects: { list: new Date(), get: new Date() },
  datasets: { list: new Date(), get: new Date() },
  entries:  { list: new Date(), get: new Date() },
  // ... organizations, accounts, jobs, exports, logs, etc.
});
```

Usage pattern in Svelte templates:

```svelte
{#key $refetches.entries.list}
  <DatasourceTable dataSource={entriesBackendDataSource} ... />
{/key}
```

When a write occurs, the caller sets `refetches.update(r => ({ ...r, entries: { ...r.entries, list: new Date() } }))`, which causes Svelte to destroy and recreate the `{#key}` block, triggering a fresh `list()` call.

---

### CommandManager (`src/lib/plugin/v2/driver/manager/command-manager.ts`)

Undo/redo command stack used in the annotation workspace. Part of the V2 plugin driver system.

#### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxStack` | 200 | Maximum undo depth |
| `combineWindow` | 5000ms | Time window for auto-combining rapid actions |

Key provided by `CommandManagerV2`:

| Method | Description |
|--------|-------------|
| `register(opts)` | Register a command with name, modes, shortcut, callback, group, activeWhen |
| `call(name, ...opts)` | Execute a command by name. Pushes undoable actions onto the stack |
| `undo(count)` | Pop from undo stack, push to redo stack, call `action.undo()` |
| `redo(count)` | Pop from redo stack, push to undo stack, call `action.do()` |
| `canUndo()` / `canRedo()` | Check stack availability |
| `getActiveCommands()` | Commands available in the current mode (filtered by mode + `activeWhen`) |
| `getAllCommands(mode)` | All commands grouped by `group` field, filtered by mode + `activeWhen` |
| `resolveKeyEvent(event, mode)` | Resolve keyboard event to a registered shortcut. Returns `true` if handled |

#### Shortcut Normalization

On Apple platforms, all shortcut strings using `Control` are automatically normalized to `Meta`, so command registration can always use the canonical `Control+…` form across platforms.

#### Command Descriptor

```typescript
interface ICommandDescriptor {
  name: string;
  group?: string;
  modes: string[];
  shortcut: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  activeWhen?: () => boolean;
}

interface ICommandAction {
  do(): void;
  undo?(): void;
  isCombinable?(other: ICommandAction): boolean;
  combine?(other: ICommandAction): ICommandAction;
}
```

#### Auto-Combine

When an undoable action is executed within `combineWindow` (5s) of the previous action, and the new action declares itself combinable with the previous one, the two are merged into a single undo entry.

---

## Plugin System (`src/lib/plugin/`)

### Architecture

The annotation workspace at `/entries/[entryId]/plugin/[pluginId]` hosts external plugins (e.g., the video annotation plugin) in a sandboxed driver environment.

```
IdahPlugin.svelte
├── Plugin Container (div)       ← plugin.render(parent) renders here
├── AnnotationHeaderBar          ← mode selector, toolbar, sync status
├── IdahCommandPalette           ← command palette (Ctrl+Space)
├── NoteOverlay                  ← notes displayed on canvas
└── NoteSidebar                  ← note list sidebar
```

#### IdahPlugin.svelte

The host component that:

1. Resolves the plugin from `window.idah_plugin` (global variable, set by the plugin's entry script)
2. Calls `plugin.init(driver.sealed())` — passing a readonly proxy of the driver
3. Calls `plugin.render(container)` — giving the plugin a DOM element to render into
4. Calls `plugin.close()` on destroy — cleanup

The `sealed()` method creates a plain object proxy (readonly) exposing only the public `IIdahDriverV2` interface — no access to internal methods like `resetCache()`, `resumeSync()`, or `notesAdapter`.

### Plugin Interface (IPluginDriver)

```typescript
interface IPluginDriver {
  get name(): string;        // Unique identifier
  get label(): string;       // Human-readable label
  get description(): string; // Short description
  get version(): string;     // Plugin version
  get type(): string;        // Plugin type identifier
  init(driver: IIdahDriverV2): void;    // Called with sealed driver
  render(parent: HTMLElement): void;    // Render into parent DOM element
  close(): void;                         // Cleanup on unmount
}
```

### Driver API (IIdahDriverV2)

The full driver interface at `src/lib/plugin/v2/types.ts`:

#### Context (readonly properties)

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Entry ID |
| `dataset` | `IDatasetInfo` | `{ id, name, modality }` |
| `project` | `IProjectInfo` | `{ id, name }` |
| `media` | `IMediaInfo` | `{ id, resource, key, mime_type, filename, meta, url }` |
| `workflowStep` | `string` | Current workflow step (e.g., "start", "annotation", "review") |
| `mode` | `string` | Current mode (e.g., "editor", "review", "note") |
| `config` | `IConfig` | Full labeling configuration (from dataset) |

#### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `setMode(mode)` | Switch to a different mode. Fires `onModeChange` |
| `onModeChange(cb)` | Subscribe to mode changes. Returns `Unsubscribe` |
| `onReady(cb)` | Called when all pending sync operations complete |
| `onSyncChange(cb)` | Called when pending queue count changes (`{ queued: number }`) |
| `onSyncError(cb)` | Called when the backend rejects a request (`{ message, code, failedCount }`) |

#### Sub-modules

| Module | Interface | Description |
|--------|-----------|-------------|
| `command` | `ICommandDriverV2` | Command palette, keyboard shortcuts, undo/redo |
| `toolbar` | `IToolbarDriverV2` | Toolbar items, groups, separators, toggle groups |
| `annotations` | `IAnnotationsDriverV2<Shape, Annotation>` | Annotation CRUD + filtering |
| `notes` | `INotesDriverV2` | Note CRUD, anchors, comments, screen positions |
| `stats` | `IStatsDriverV2` | Statistics provider registration |

#### Keyboard Dispatch

```typescript
handleKeydown(event: KeyboardEvent): boolean;
```
Top-level keyboard event dispatcher. Returns `true` if handled (caller should `preventDefault`). By default, `Ctrl+Space` (or `Meta+Space` on Mac) opens the command palette.

#### Config Filtering

```typescript
getFilteredConfig(shapeType: string, value, objectName?): IShapeConfig | undefined;
```
Returns a shape config with properties filtered by AST-based visibility rules against the current annotation value.

### Annotations with IndexedDB (Local-First)

The annotation driver uses IndexedDB for local-first annotation storage, with asynchronous backend synchronization.

#### IndexedDB Schema

Database name: `idahPlugin::{pluginId}`

**Object Stores:**

| Store | Key Path | Indexes |
|-------|----------|---------|
| `annotations` | `[entryId, id]` | `entryId` |
| `entries` | `entryId` | `lastVisitedAt` |

**Eviction:** Entries not visited in 14 days are evicted during sync.

#### Sync Protocol

```
First load:
  fetch backend annotations since lastUpdatedAt
    → merge or overwrite local IDB records
    → fire syncChange({ queued: 0 })

Writes:
  1. Write to IDB immediately
  2. Enqueue backend operation (promise pushed to #enqueue)
  3. Fire syncChange({ queued: N }) for each pending operation
  4. When all resolve: fire syncChange({ queued: 0 })

On sync error:
  → Pause RPC queue
  → Fire syncError({ message, code, failedCount })
  → Driver setMode("error")
  → User explicitly retries (core.retry command → resumeSync())
```

#### Fallback

When IndexedDB is unavailable (e.g., SSR), the driver falls back to `AnnotationsDriverAdapter` which uses direct JSON-RPC calls without local caching.

---

## UI Patterns

### DatasourceTable

The primary pattern for all list views. Located at `src/lib/components/app/datasource-table/`.

Uses `@tanstack/table-core` for headless table state management. Rows, columns, filters, pagination, and sorting are all driven by `DataSource` instances.

```
datasource-table.svelte
├── datasource-table-header.svelte    ← Column headers with sort indicators
├── datasource-table-body.svelte      ← Row rendering with column cell templates
├── datasource-table-content.svelte   ← Table content wrapper
├── datasource-table-loading.svelte   ← Loading skeleton
├── datasource-table-empty.svelte     ← Empty state ("No results")
├── datasource-table-error.svelte     ← Error state
├── datasource-table-paginator.svelte ← Pagination controls
├── datasource-table-toolbar-actions.svelte ← Filter toggles, column visibility, search
├── datasource-table-toggle-columns.svelte  ← Column visibility menu
├── datasource-table-head-label.svelte    ← Column label with tooltip
├── datasource-table-head-options.svelte  ← Sort + filter per column
├── datasource-table.stores.svelte.ts     ← Svelte 5 rune-based state
└── filters/                         ← Filter UI components
```

### PageProvider

A wrapper component for authorization checks at the page level:

```svelte
<PageProvider name="projects" action="read" resource="dataset:projects">
  {@render children()}
</PageProvider>
```

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Page name (used as `id` on the section element) |
| `action` | `Action` | Required action (e.g., "read", "create") |
| `resource` | `Resource` | Target resource (e.g., `"dataset:projects"`) |
| `scopes` | `Scope[]` | Optional scopes for fine-grained checks |
| `roles` | `Role[]` | Optional role restriction |
| `redirectTo` | `string` | Redirect URL on access denied (default: `/projects`) |

On access denied, renders a `<Redirect>` component. On access granted, renders the `<ApplicationHeader>` and wraps content in a `<section>` element.

### Toaster (sonner)

Custom toast icons configured in the root `+layout.svelte`:

```svelte
<Toaster position="bottom-center" richColors>
  {#snippet loadingIcon()}<LoaderCircleIcon class="size-4 animate-spin" />{/snippet}
  {#snippet successIcon()}<CircleCheckIcon class="size-4" />{/snippet}
  {#snippet errorIcon()}<CircleAlertIcon class="size-4" />{/snippet}
  {#snippet infoIcon()}<InfoIcon class="size-4" />{/snippet}
  {#snippet warningIcon()}<TriangleAlertIcon class="size-4" />{/snippet}
</Toaster>
```

Error toasts are automatically triggered by `BackendDataSource` when the API returns errors (unless `showErrorToast: false` is passed in options).

### Dark/Light Mode

Handled by `<ModeWatcher />` from `mode-watcher`, placed in the root layout. CSS variables for both themes are defined in `app.css` with `:root` (light) and `.dark` (dark) blocks. Tailwind CSS 4's `@custom-variant dark (&:is(.dark *))` enables `dark:` utility variants.

### Tailwind CSS 4

The project uses the new Tailwind CSS 4 `@import "tailwindcss"` syntax. The `@tailwindcss/vite` plugin handles compilation. Theme tokens are defined in `app.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --radius-lg: var(--radius);
  /* ... */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

---

## File Organization

```
src/
├── app.html                        # HTML shell
├── app.css                         # Tailwind CSS 4 entry + CSS variables
├── app.d.ts                        # TypeScript ambient declarations
├── lib/
│   ├── index.ts                    # Barrel exports
│   ├── utils.ts                    # re-exports from utils/
│   ├── components/
│   │   ├── ui/                     # bits-ui / shadcn-svelte components
│   │   │   ├── button/, dialog/, command/, dropdown-menu/, ...
│   │   │   └── sonner/             # Toast wrapper
│   │   └── app/                    # Application-specific components
│   │       ├── application/        # App chrome: header, sidebar, nav
│   │       ├── page/               # PageProvider, PageHeader, PageBreadcrumb
│   │       ├── datasource-table/   # Generic table for all list views
│   │       ├── datasets/           # Dataset-specific components
│   │       ├── projects/           # Project-specific components
│   │       ├── forms/              # Form components
│   │       └── ...                 # Organizations, IAM, settings, etc.
│   ├── data/                       # Data access layer
│   │   ├── BackendDataSource.ts    # BackendDataSource factory
│   │   ├── MemoryDataSource.ts     # In-memory DS for testing
│   │   ├── DataSource.ts           # TypeScript interfaces
│   │   ├── Cache.ts / Cache.types.ts
│   │   ├── filtering.ts            # Filter → query string encoding
│   │   ├── jsonrpc.ts              # JSON-RPC batch client
│   │   └── model/                  # Record subclasses
│   │       ├── Record.ts           # Record base class, decorators, factory
│   │       ├── json_api.ts         # JSON:API response parsers
│   │       ├── includes.ts         # IncludeList, IncludeSet
│   │       ├── transformers.ts     # Date/time transformers
│   │       ├── types.ts            # JSON:API type definitions
│   │       ├── iam/                # Record models for IAM service
│   │       ├── dataset/            # Record models for Dataset service
│   │       ├── media/              # Record models for Media service
│   │       ├── sync/               # Record models for Sync service
│   │       ├── audit/              # Record models for Audit service
│   │       └── setting/            # Record models for Setting service
│   ├── plugin/                     # Plugin hosting
│   │   ├── IdahPlugin.svelte       # Plugin host component
│   │   ├── layout/                 # Plugin layout components
│   │   └── v2/                     # V2 driver system
│   │       ├── types.ts            # IIdahDriverV2, IPluginDriver, and sub-types
│   │       ├── driver/
│   │       │   ├── index.ts        # IdahDriverV2 class + createIdahDriverV2 factory
│   │       │   ├── adapter/        # Adaptors: command, toolbar, annotations, notes, stats, IDB
│   │       │   └── manager/        # CommandManagerV2, ToolbarManagerV2
│   │       ├── components/         # Command palette, etc.
│   │       └── utils/              # AST evaluator, shortcut utils, browser detection
│   ├── context/                    # Domain context interfaces
│   │   ├── ActivityContext.ts      # Activity/annotation context types
│   │   ├── AnnotationContext.ts    # Annotation CRUD context
│   │   └── ActivityContextExample.ts
│   ├── security/                   # Authorization
│   │   ├── AuthContext.ts          # AuthContext class + authStatus store
│   │   ├── ActionMap.ts            # Trie-based permission map
│   │   ├── can.svelte              # Conditional rendering component
│   │   └── types.ts                # Action, Resource, Scope type constants
│   ├── shortcut/                   # Keyboard shortcut system
│   │   └── ShortcutManager.svelte.ts
│   └── hooks/
│       └── is-mobile.svelte.ts     # Reactive mobile detection
└── routes/                         # SvelteKit file-based routing
```
