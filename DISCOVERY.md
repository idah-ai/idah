# DISCOVERY.md — Phase 0 findings

## 1. Repo Layout

This is a **monorepo** with the following relevant locations:

| Component | Path |
|-----------|------|
| Frontend core (SvelteKit) | `app/frontend/` |
| Image plugin (SvelteKit) | `plugins/idah-image/frontend/` |
| Video plugin (SvelteKit) | `plugins/idah-video/frontend/` |

Each plugin is a **fully independent SvelteKit app** with its own `package.json`,
`vite.config.ts`, and `node_modules`. They are loaded at runtime via
`window.idah_plugin` (see `app/frontend/src/lib/plugin/IdahPlugin.svelte`).

There is **no shared `packages/` directory** for shared TypeScript libraries.
The image and video plugins each have their own copy of math utilities.

---

## 2. Shared packages (math utils) — duplicated, not shared

Both plugins maintain **separate copies** of identical math utilities:

| Module | Image plugin | Video plugin |
|--------|-------------|-------------|
| `math/point.ts` | `plugins/idah-image/.../lib/utils/math/point.ts` | `plugins/idah-video/.../lib/utils/math/point.ts` |
| `math/bbox.ts` | `plugins/idah-image/.../lib/utils/math/bbox.ts` | `plugins/idah-video/.../lib/utils/math/bbox.ts` |
| `math/polygon.ts` | `plugins/idah-image/.../lib/utils/math/polygon.ts` | `plugins/idah-video/.../lib/utils/math/polygon.ts` |
| `math/polygon.spec.ts` | same | same |
| `math/bbox.spec.ts` | same | same |
| `math/point.spec.ts` | same | same |
| `interpolation.ts` | ❌ N/A | `plugins/idah-video/.../lib/utils/interpolation.ts` |

The shared `Point` type is: `type Point = [number, number]` (tuple, not `{x,y}`).

Since no shared package already exists, **this task will create a new shared
package `packages/snap-engine` at the monorepo root** (not under `app/` or
`plugins/`). Both plugins will import from it.

---

## 3. Per-plugin locations

### Image plugin

| Concern | File / component |
|---------|-----------------|
| **SVG canvas root** | `plugins/idah-image/frontend/src/lib/components/App/Viewport/Viewport.svelte` — wraps a `<div>` with CSS transforms for pan/zoom |
| **Shape overlay SVG** | `plugins/idah-image/.../ShapesContainer.svelte` — renders `<svg>` on top of `<Viewport>`, includes all shape components and creation overlays |
| **Draw tool — BBox** | `plugins/idah-image/.../BBoxCreateShape.svelte` — `handleMouseDown(cursor)`, `handleMouseUp(cursor)` |
| **Draw tool — Polygon** | `plugins/idah-image/.../PolygonCreateShape.svelte` — `handleMouseDown(cursor)` |
| **Draw tool — Circle** | `plugins/idah-image/.../CircleCreateShape.svelte` — `handleMouseDown(cursor)`, `handleMouseUp(cursor)` |
| **Draw tool — Ellipse** | `plugins/idah-image/.../EllipseCreateShape.svelte` — `handleMouseDown(cursor)`, `handleMouseUp(cursor)` |
| **Draw tool — Line** | `plugins/idah-image/.../LineCreateShape.svelte` — `handleMouseDown(cursor)` |
| **Screen→Canvas transform** | `viewport.workspace.screenToScene(sx, sy)` in `plugins/idah-image/.../state/viewport.svelte.ts` — returns `{x, y}` in *scene* (unscaled) space. Then *normalized* to 0-1 via `[x/mediaWidth, y/mediaHeight]` |
| **`setTools()` call site** | `plugins/idah-image/.../toolbar/index.ts` — calls `driver.toolbar.add({...})` for each tool |
| **Annotation store** | `data.annotations` — reactive store in `plugins/idah-image/.../state/data.svelte.ts`, backing `ShapesContainer`'s `visibleAnnotations` |

### Video plugin

| Concern | File / component |
|---------|-----------------|
| **SVG canvas root** | `plugins/idah-video/.../Viewport.svelte` |
| **Shape overlay SVG** | `plugins/idah-video/.../ShapesContainer.svelte` |
| **Draw tool — BBox** | `plugins/idah-video/.../BBoxCreateShape.svelte` |
| **Draw tool — Polygon** | `plugins/idah-video/.../PolygonCreateShape.svelte` |
| **Screen→Canvas transform** | `viewport.workspace.screenToScene()` in `plugins/idah-video/.../state/viewport.svelte.ts` — same pattern as image |
| **Annotation store** | `data.annotations` in `plugins/idah-video/.../state/data.svelte.ts` |
| **Toolbar registration** | `plugins/idah-video/.../toolbar/index.ts` |

---

## 4. Shape data models

### Image plugin

| Shape kind | Type constant | Data shape |
|-----------|--------------|------------|
| Box | `idah-image:bounding-box` | `{ type, points: [tl, tr, br, bl] (4×[x,y] normalized), angle: number }` |
| Polygon | `idah-image:polygon` | `{ type, points: [[x1,y1], [x2,y2], ...] (N×[x,y] normalized) }` |
| Line | `idah-image:line` | `{ type, points: [[x1,y1], [x2,y2]] (2×[x,y] normalized) }` |
| Circle | `idah-image:circle` | `{ type, points: [[cx,cy]], radius: number (0-1, relative to min(w,h)) }` |
| Ellipse | `idah-image:ellipse` | `{ type, points: [[cx,cy],[rx,ry]], angle: number }` |

All points are **normalized 0–1** relative to media dimensions.

### Video plugin

| Shape kind | Type constant | Data shape |
|-----------|--------------|------------|
| Box | `idah-video:bounding-box` | `{ type, start, end, frames: [{frame, points: [tl,tr,br,bl], angle}] }` |
| Polygon | `idah-video:polygon` | `{ type, start, end, frames: [{frame, points: [...]}] }` |

Video shapes wrap the same point structures as image shapes, but inside
keyframes (`shape.frames[]`). The current frame's geometry is resolved via
`getInterpolatedFrame(shape, currentFrame)` in
`plugins/idah-video/.../lib/utils/interpolation.ts`, which returns
`{ points, angle }`.

---

## 5. Framework details

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`).
- SVG is raw (no wrapper library).
- Pointer coordinates arrive as **screen pixels** via `MouseEvent.offsetX/Y`
  and are manually converted to scene space via `viewport.workspace.screenToScene()`,
  then normalized to 0–1 via `[x / mediaWidth, y / mediaHeight]`.
- The `Point` type is `[number, number]` everywhere.

---

## 6. Video interpolation

**File:** `plugins/idah-video/.../lib/utils/interpolation.ts`

- `getInterpolatedFrame(shape, currentFrame)` returns the interpolated
  geometry `{ points, angle }` for a shape on any given frame.
- Uses linear interpolation between surrounding keyframes (or exact match).
- For polygon, uses `interpolatePolygon()` from `math/polygon.ts`.
- **This is the function the snap engine must call** — never raw
  `shape.frames` directly, since interpolated values only exist per-frame
  through this function.

---

## 7. Core↔Plugin state mechanism

**Current state:** There is **no existing mechanism** for core to expose a
global boolean flag to plugins. The `IIdahDriverV2` interface
(`app/frontend/src/lib/plugin/v2/types.ts`) and its implementation
(`IdahDriverV2` in `driver/index.ts`) have:

- `mode` / `setMode()` — for tool/workflow mode
- `config` — project-level labeling config (read-only)
- `accountSettings` — per-user preferences (persisted, not session-scoped)

None of these are suitable for a session-scoped on/off toggle.

**Plan:** We will add:
1. A `magneticSnapEnabled: boolean` field (with a setter and `onMagneticSnapChange` subscriber) to `IIdahDriverV2`.
2. A magnet-icon toggle in `annotation-header-bar-tools.svelte` (core UI, not plugin-owned).
3. The plugin reads `driver.magneticSnapEnabled` — works identically for
   both image and video plugins.

---

## 8. Key implementation decisions

### Where to put `packages/snap-engine`

At the **monorepo root**: `idah/packages/snap-engine/`.

Both plugin `package.json` files will reference it via a relative path
(e.g. `"@idah/snap-engine": "file:../../packages/snap-engine"`) or via
workspace protocol if pnpm workspaces are enabled. If not, we'll use
`file:` references.

### No build step for snap-engine needed initially

The engine is pure TypeScript and can be consumed via TypeScript path
mapping (`paths` in `tsconfig.json`) or a simple `file:` dependency. If
the plugins use Vite, raw `.ts` imports from outside the project root
require special configuration (likely the simplest approach is to ship
the engine as prebuilt `.js` + `.d.ts` or to use a Vite plugin).

### ShapesContainer modifications

Both plugins' `ShapesContainer.svelte` components handle:
- `onMouseMove` — updates `sceneNormalizedCursor`
- `onMouseDown` — delegates to creation shape's `handleMouseDown`
- `onMouseUp` — delegates to creation shape's `handleMouseUp`

The snap query runs in the plugin's pointer-event handler, *before*
passing the coordinate to the creation shape. Specifically:

```ts
function onMouseMove(e: MouseEvent) {
  let cursor = screenToCanvas(e);
  if (driver.magneticSnapEnabled) {
    const snap = snapEngine.querySnap(cursor, { ... });
    if (snap) cursor = snap.point;
  }
  // ... existing cursor handling ...
}
```

### Video-specific: what shapes exist on this frame

For video, `ShapesContainer` already computes `visibleAnnotations` using
`getInterpolatedFrame` per annotation. We'll reuse the same filtered list
as the `SnapEngine.setTargets()` input — no need for a separate
interpolation pass.

---

## Summary of new files / changes

| File | Action |
|------|--------|
| `packages/snap-engine/src/index.ts` | Create — exports `SnapEngine`, `ShapeAdapter`, types |
| `packages/snap-engine/src/geometry.ts` | Create — `nearestPointOnSegment`, `nearestPointOnEllipseArc`, `segmentSegmentIntersection`, `segmentEllipseIntersection` |
| `packages/snap-engine/src/spatial-index.ts` | Create — uniform grid spatial index |
| `packages/snap-engine/package.json` | Create |
| `packages/snap-engine/tsconfig.json` | Create |
| `app/frontend/src/lib/plugin/v2/types.ts` | Edit — add `magneticSnapEnabled`, `onMagneticSnapChange` to `IIdahDriverV2` |
| `app/frontend/src/lib/plugin/v2/driver/index.ts` | Edit — implement `magneticSnapEnabled`, `setMagneticSnapEnabled`, `onMagneticSnapChange` in `IdahDriverV2` |
| `app/frontend/src/lib/plugin/layout/header/annotation-header-bar-tools.svelte` | Edit — add magnet toggle button |
| `plugins/idah-image/frontend/src/lib/components/App/Viewport/Shapes/ShapesContainer.svelte` | Edit — wire snap engine into mouse handlers, add snap visual overlay |
| `plugins/idah-video/frontend/src/lib/components/App/Viewport/Shapes/ShapesContainer.svelte` | Edit — same as above |
| Both plugins | Edit `index.ts` — register adapters at init time |
| Both plugins | `package.json` — add dependency on `@idah/snap-engine` |
