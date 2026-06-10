# IDAH Image Annotation — Frontend

This is the frontend component of the **IDAH Image Annotation** plugin. It provides a full-featured image annotation workspace with support for bounding boxes, polygons, notes, undo/redo, keyboard shortcuts, and a command palette.

**Version:** 1.0.0

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the development server (mock environment)
pnpm dev

# Build for production
pnpm build
```

The dev server starts at [http://localhost:5173](http://localhost:5173). A mock driver with sample data is loaded automatically so you can develop without the full IDAH backend.

---

## Technology Stack

| Layer           | Technology                        |
| --------------- | --------------------------------- |
| Framework       | SvelteKit 5 with Svelte 5 (runes) |
| Language        | TypeScript                        |
| Styling         | Tailwind CSS 4                    |
| UI Components   | bits-ui (shadcn-svelte)           |
| Build Tool      | Vite 7                            |
| Package Manager | pnpm                              |
| Testing         | Vitest                            |

---

## Project Structure

```
src/
├── idah/v2/
│   └── types.ts                  # IIdahDriverV2 type definitions (host API contract)
│
├── lib/
│   ├── index.ts                  # Plugin entry point — exports IPluginDriver
│   ├── types.ts                  # Image-specific types (shapes, records)
│   ├── utils.ts                  # General utilities
│   │
│   ├── assets/
│   │   ├── theme.css             # Plugin CSS theme
│   │   └── icons/                # SVG icons for toolbar & commands
│   │
│   ├── commands/                 # Undoable command implementations
│   │   ├── annotation/           # add, update, delete, keyframe, polygon, visibility/editable toggle
│   │   ├── category/             # category delete, toggle visibility/editable
│   │   ├── display/              # color mode, debug console, render mode toggles
│   │   ├── group/                # group delete, toggle visibility/editable
│   │   ├── mode/                 # bounding-box, polygon, note, select mode switches
│   │   ├── note/                 # add note, goto note
│   │   ├── selection/            # center, delete, goto selection
│   │   └── viewport/             # reset, zoom-in, zoom-out
│   │
│   ├── components/
│   │   ├── Plugin.svelte         # Root component (mounts ImageAnnotationWorkspace)
│   │   ├── App/
│   │   │   ├── ImageAnnotationWorkspace/  # Main workspace layout + logic
│   │   │   ├── CategorySelector/          # Annotation & properties sidebars
│   │   │   ├── ConfirmDialog/             # Delete confirmation dialog
│   │   │   ├── ContextMenu/               # Right-click context menu
│   │   │   ├── SelectionPanel/            # Category/value property editor
│   │   │   └── Viewport/                  # Image viewport, shapes overlay, sync indicator
│   │   └── ui/                            # Generic UI primitives (Button, Dialog, Popover, etc.)
│   │
│   ├── hooks/
│   │   └── is-mobile.svelte.ts    # Mobile detection hook
│   │
│   ├── state/                     # Reactive state stores (Svelte 5 $state runes)
│   │   ├── annotation.svelte.ts   # Hidden/locked annotation IDs
│   │   ├── data.svelte.ts         # Global data store (loaded from driver)
│   │   ├── driver.svelte.ts       # V2 driver singleton
│   │   ├── entry-root.svelte.ts   # Entry-root annotation reference
│   │   ├── media.svelte.ts        # Media URL derivation
│   │   ├── selection.svelte.ts    # Current selection state
│   │   ├── ui.svelte.ts           # UI state (debug console, color mode, render mode)
│   │   └── viewport.svelte.ts     # Viewport mode, zoom, pan, image frame
│   │
│   ├── toolbar/
│   │   └── index.ts               # Toolbar registration (Select, Bounding Box, Polygon, Note)
│   │
│   └── utils/
│       ├── annotation.ts         # Annotation helpers
│       ├── browser.ts            # Browser feature detection
│       ├── color.ts              # Color utilities
│       ├── delayed.ts            # Delayed execution helper
│       ├── interpolation.ts      # Frame interpolation
│       ├── string.ts             # String utilities
│       ├── styles.ts             # Style helpers
│       ├── types.ts              # Utility types
│       └── math/
│           ├── bbox.ts           # Bounding box math
│           ├── point.ts          # Point math
│           └── polygon.ts        # Polygon math (area, containment, etc.)
│
├── routes/
│   ├── +layout.svelte            # Root layout
│   ├── +page.svelte              # Plugin mount page (uses mock driver)
│   └── mock/                     # Standalone mock development environment
│       ├── +page.svelte          # Mock page entry
│       ├── mock-driver.ts        # In-memory IIdahDriverV2 implementation
│       ├── command-manager.ts    # Undo/redo command manager (V2)
│       ├── command-palette.svelte
│       ├── toolbar-manager.ts    # Toolbar item manager (V2)
│       ├── in-memory-store.ts    # In-memory annotation/note storage
│       ├── shortcut-utils.ts     # Keyboard shortcut resolution
│       └── ast-evaluator.ts      # AST-based conditional property visibility
│
└── static/
    └── mock-image.jpg            # Placeholder image for mock development
```

---

## Plugin API

The plugin entry point (`src/lib/index.ts`) exports an `IPluginDriver` object:

```ts
interface IPluginDriver {
  name: string; // "idah-image"
  label: string; // "IDAH Image Annotation"
  description: string; // "A module for annotating image."
  version: string; // "1.0.0"
  type: string; // "image"
  init(driver: IIdahDriverV2): void;
  render(parent: HTMLElement): void;
  close(): void;
}
```

- **`init(driver)`** — Initializes the V2 driver, data stores, commands, and toolbar.
- **`render(parent)`** — Mounts the plugin UI into the given DOM element.
- **`close()`** — Unmounts the plugin and cleans up.

The full V2 driver contract is defined in [`src/idah/v2/types.ts`](src/idah/v2/types.ts). It includes sub-modules for:

| Sub-module    | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `annotations` | Fetch, create, update, delete annotation records      |
| `notes`       | Fetch, create, update, delete note records            |
| `command`     | Register commands, undo/redo stack, keyboard dispatch |
| `toolbar`     | Register toolbar items per mode                       |

---

## Annotation Tools

| Tool         | Mode                      | Description                                |
| ------------ | ------------------------- | ------------------------------------------ |
| Select       | `default`                 | Select and manipulate existing annotations |
| Bounding Box | `idah-image:bounding-box` | Draw rectangular bounding boxes            |
| Polygon      | `idah-image:polygon`      | Draw free-form polygon shapes              |
| Note         | `note`                    | Place comment notes on the image           |

---

## Commands

Commands are undoable actions registered with the V2 command driver. They are organized by group:

| Group      | Commands                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annotation | `annotation.add`, `annotation.delete`, `annotation.update`, `annotation.keyframe_add`, `annotation.keyframe_delete`, `annotation.polygon.add_point`, `annotation.toggle_editability_all`, `annotation.toggle_visibility_all` |
| Category   | `category.delete`, `category.toggle_editability`, `category.toggle_visibility`                                                                                                                                               |
| Display    | `display.toggle-color-mode`, `display.toggle-debug-console`, `display.toggle-render-mode`                                                                                                                                    |
| Group      | `group.delete`, `group.toggle_editability`, `group.toggle_visibility`                                                                                                                                                        |
| Mode       | `mode.bounding_box`, `mode.note`, `mode.polygon`, `mode.select`                                                                                                                                                              |
| Note       | `note.add`, `note.goto`                                                                                                                                                                                                      |
| Selection  | `selection.center`, `selection.delete`, `selection.goto`                                                                                                                                                                     |
| Viewport   | `viewport.reset`, `viewport.zoom-in`, `viewport.zoom-out`                                                                                                                                                                    |

---

## State Management

All state is managed with [Svelte 5 runes](https://svelte-5-preview.vercel.app/docs/runes) (`$state`, `$derived`, `$effect`). The state modules are plain TypeScript files (`.svelte.ts`) that export reactive objects. Key stores:

- **`data`** — Global cache of annotations and notes loaded from the driver.
- **`driver`** — Singleton reference to `IIdahDriverV2`.
- **`viewport`** — Current mode, image frame, zoom/pan transform, and creation-mode flags.
- **`selection`** — Currently selected annotation or group.
- **`annotation`** — Hidden/locked annotation ID sets (for visibility and editability toggles).
- **`media`** — Derived media URL from the driver.
- **`ui`** — Debug console visibility, color mode, render mode.
- **`entryRoot`** — Reference to the entry-root annotation (metadata container).

---

## Development

### Mock Environment

The plugin ships with a self-contained mock environment in `src/routes/mock/` that simulates the IDAH host application. It provides:

- An in-memory annotation store with pre-seeded sample data (bounding boxes and polygon).
- Label configurations for `idah-image:bounding-box` (6 categories) and `idah-image:polygon` (3 categories) with conditional property visibility.
- A mock `IIdahDriverV2` implementation with undo/redo, command palette, and toolbar support.
- Keyboard shortcut resolution.

For details, see [`src/routes/mock/README.md`](src/routes/mock/README.md).

### Setting Up a Mock Image

Place an image file in `static/` (e.g., `mock-image.png`) and update `src/routes/mock/mock-driver.ts` if needed. See [`static/README.md`](static/README.md) for instructions.

### Available Scripts

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Start Vite dev server (mock environment) |
| `pnpm build`       | Production build to `build/` directory   |
| `pnpm build:watch` | Build in watch mode                      |
| `pnpm preview`     | Preview the production build             |
| `pnpm check`       | Type-check with `svelte-check`           |
| `pnpm test`        | Run unit tests with Vitest               |
| `pnpm test:watch`  | Run tests in watch mode                  |

### Build Output

The production build outputs a library to `build/`:

```
build/
├── plugin.es.js       # ESM bundle
├── plugin.umd.js      # UMD bundle
├── plugin.css         # Extracted CSS
└── *.svg              # Icon assets
```

The library is registered on `window.idah_plugin` and consumed by the IDAH host application.

### Testing

Tests use **Vitest** and are co-located with their source files (`.test.ts` suffix). Test files exist for all state modules: `annotation`, `data`, `driver`, `entry-root`, `media`, `selection`, `ui`, `viewport`, and math utilities (`bbox`, `point`, `polygon`).

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Watch mode
```

---

## Documentation

- **[Plugin Development Guide](https://docs.idah.ai/plugin/)** — Official IDAH plugin documentation
- **[Frontend Guide](https://docs.idah.ai/plugin/frontend-guide/)** — Build plugin UIs with SvelteKit and Svelte 5
- **[Create a Plugin](https://docs.idah.ai/plugin/create-plugin/)** — CLI scaffolding guide
- **[Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)** — Svelte 5 runes and component API
- **[bits-ui Documentation](https://bits-ui.com/)** — Headless UI component library
