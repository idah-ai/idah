<script lang="ts">
  // ---------------------------------------------------------------------------
  // MaskCanvasLayer.svelte — Canvas overlay for mask annotation rendering
  //
  // Renders both committed mask tiles (from backend annotations) and
  // in-progress session tiles on an HTMLCanvasElement.
  //
  // Performance:
  //   - Committed tiles render through the shared decode cache (tile-cache.ts)
  //     which produces ImageBitmaps for each tile. These are composited onto
  //     the main canvas via ctx.drawImage(), a single GPU call per tile.
  //   - Session tiles (in-progress brush strokes) are rasterized to per-tile
  //     ImageBitmaps using ImageData (not per-pixel fillRect), then composited
  //     with drawImage().  Per-tile version tracking ensures only tiles that
  //     actually changed are re-rasterized each frame.
  // ---------------------------------------------------------------------------

  import { onMount, onDestroy } from "svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { maskSession } from "$lib/state/mask-session.svelte";
  import { applyViewportTransform, MASK_COLORS, COMMIT_ALPHA, HIGHLIGHT_ALPHA, withAlpha } from "$lib/mask/canvas-render";
  import { IMAGE_MASK } from "$lib/types";
  import { data } from "$lib/state/data.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import { MASK_TILE_SIZE } from "$lib/mask/constants";
  import { getDriver } from "$lib/state/driver.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { getOrCreate, invalidateAll } from "$lib/mask/tile-cache";
  import { ui } from "$lib/state/ui.svelte";

  interface Props {
    visible?: boolean;
    /** Category color for in-progress session tiles (from workspace pendingValue). */
    previewColor?: string;
  }

  let { visible = true, previewColor = undefined }: Props = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let ctx: CanvasRenderingContext2D | null = $state(null);

  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let isDragging = $state(false);

  let redrawScheduled = false;

  // ─── Session tile bitmap cache (per-tile, version-tracked) ──────────────
  /** Per-tile cached ImageBitmap for session buffers. */
  let _sessionTileBitmaps = new Map<string, ImageBitmap>();
  /** Cached version for each session tile bitmap. */
  let _sessionTileVersions = new Map<string, number>();
  /** Unsubscribe from maskSession.onChange — cleaned up in onDestroy. */
  let _unsubscribeSession: (() => void) | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  onMount(() => {
    if (!canvasEl) return;
    ctx = canvasEl.getContext("2d");
    resizeCanvas();
    _unsubscribeSession = maskSession.onChange(() => scheduleRedraw());
    redraw();
  });

  onDestroy(() => {
    if (settleTimer) clearTimeout(settleTimer);
    _unsubscribeSession?.();
    // Free session tile bitmaps
    for (const bmp of _sessionTileBitmaps.values()) {
      bmp.close();
    }
    _sessionTileBitmaps.clear();
    _sessionTileVersions.clear();
  });

  // ─── Resize to match viewport dimensions ─────────────────────────────────

  function resizeCanvas(): void {
    if (!canvasEl) return;
    const [vw, vh] = viewport.workspace.dimensions;
    if (vw <= 0 || vh <= 0) return;
    canvasEl.width = vw;
    canvasEl.height = vh;
  }

  // ─── Redraw ─────────────────────────────────────────────────────────────

  function redraw(): void {
    redrawScheduled = false;
    if (!ctx || !canvasEl || !visible) return;

    const t = viewport.workspace.transform;

    // Reset transform, clear once, then re-apply
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    // Follow the user's render-mode preference so the mask overlay
    // matches the image layer (nearest-neighbour for crisp zoom,
    // bilinear for smooth zoom).
    ctx.imageSmoothingEnabled = ui.renderMode === "bilinear";
    applyViewportTransform(ctx, t.scale, t.translate[0], t.translate[1]);

    // ── Render committed mask tiles from backend annotations ──────────
    if (data.annotations) {
      for (const ann of data.annotations.items) {
        const shape = ann.shape as Record<string, unknown>;
        if (shape?.type !== IMAGE_MASK) continue;

        // Skip hidden annotations
        if (annotation.isHidden(ann)) continue;

        // For the annotation currently being edited, render only the tiles
        // that the session buffer hasn't touched. Session tiles are rendered
        // on top below, so the edited tiles appear highlighted while the rest
        // of the mask stays visible.
        const isEditing = ann.id === maskSession.annotationId;

        // Resolve color from the annotation's category
        const catId = (ann.value as Record<string, unknown>)?.category as string | undefined;
        const isSelected = ann.id === selection.value?.id;
        const baseColor = catId ? resolveCategoryColor(catId) : MASK_COLORS[0];
        const color = isSelected
          ? withAlpha(baseColor, HIGHLIGHT_ALPHA)
          : withAlpha(baseColor, COMMIT_ALPHA);

        // Render each committed tile using the shared cache (drawImage)
        for (const [key, val] of Object.entries(shape)) {
          if (!key.startsWith("tile-")) continue;
          const match = key.match(/^tile-(\d+)x(\d+)$/);
          if (!match) continue;
          const col = parseInt(match[1], 10);
          const row = parseInt(match[2], 10);
          const tileData = val as { rle?: string } | undefined;
          if (!tileData?.rle) continue;
          // When editing, skip tiles that are in the session buffer —
          // they'll be rendered on top with highlight alpha.
          if (isEditing && maskSession.tileBuffers.has(`${col}:${row}`)) continue;

          // Get or create the cached bitmap for this tile, using the
          // annotation's resolved color. Then composite it onto the main
          // canvas with a single drawImage call.
          const tileKey = `${col}:${row}`;
          const { bitmap } = getOrCreate(ann.id, tileKey, tileData.rle, color);
          ctx.drawImage(
            bitmap,
            col * MASK_TILE_SIZE,
            row * MASK_TILE_SIZE,
            MASK_TILE_SIZE,
            MASK_TILE_SIZE,
          );
        }
      }
    }

    // ── Render in-progress session tiles on top (highlighted) ────────
    if (maskSession.tileBuffers.size > 0) {
      renderSessionLayer();
    }
  }

  /**
   * Render in-progress session tiles using per-tile cached bitmaps.
   * Only re-rasterizes tiles whose buffer has changed since the last frame.
   * Uses ImageData for efficient pixel rasterization (avoids per-pixel fillRect).
   */
  function renderSessionLayer(): void {
    if (!ctx) return;

    // Resolve the session color
    let sessionColor: [number, number, number, number] = MASK_COLORS[1];
    if (previewColor) {
      sessionColor = parseHexColor(previewColor);
    } else {
      const sel = selection.value;
      const catId = sel && (sel.shape as any)?.type === IMAGE_MASK
        ? (sel.value as any)?.category as string | undefined
        : undefined;
      if (catId) {
        sessionColor = resolveCategoryColor(catId);
      }
    }
    sessionColor = withAlpha(sessionColor, HIGHLIGHT_ALPHA);

    const [r, g, b, a] = sessionColor;

    for (const [key, buffer] of maskSession.tileBuffers) {
      const [colStr, rowStr] = key.split(":");
      const col = parseInt(colStr, 10);
      const row = parseInt(rowStr, 10);
      const tileX = col * MASK_TILE_SIZE;
      const tileY = row * MASK_TILE_SIZE;

      // Check if this tile's bitmap is cached and up-to-date
      const cachedVersion = _sessionTileVersions.get(key) ?? -1;
      const currentVersion = maskSession.getTileVersion(key);

      let bitmap = _sessionTileBitmaps.get(key);
      if (!bitmap || cachedVersion !== currentVersion) {
        // Rasterize this session tile to an offscreen bitmap using ImageData
        if (bitmap) bitmap.close(); // free old GPU memory

        const imageData = new ImageData(MASK_TILE_SIZE, MASK_TILE_SIZE);
        const pixels = imageData.data;

        for (let py = 0; py < MASK_TILE_SIZE; py++) {
          for (let px = 0; px < MASK_TILE_SIZE; px++) {
            if (buffer[py * MASK_TILE_SIZE + px] === 1) {
              const idx = (py * MASK_TILE_SIZE + px) * 4;
              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
              pixels[idx + 3] = a;
            }
          }
        }

        const offscreen = new OffscreenCanvas(MASK_TILE_SIZE, MASK_TILE_SIZE);
        const octx = offscreen.getContext("2d")!;
        octx.imageSmoothingEnabled = false;
        octx.putImageData(imageData, 0, 0);

        bitmap = offscreen.transferToImageBitmap();
        _sessionTileBitmaps.set(key, bitmap);
        _sessionTileVersions.set(key, currentVersion);
      }

      // Composite with a single drawImage call
      ctx.drawImage(
        bitmap,
        tileX,
        tileY,
        MASK_TILE_SIZE,
        MASK_TILE_SIZE,
      );
    }

    // Clean up bitmaps for tiles that are no longer in the session
    for (const [key, bmp] of _sessionTileBitmaps) {
      if (!maskSession.tileBuffers.has(key)) {
        bmp.close();
        _sessionTileBitmaps.delete(key);
        _sessionTileVersions.delete(key);
      }
    }
  }

  /**
   * Resolve the RGBA color for a category ID using the driver config.
   */
  function resolveCategoryColor(categoryId: string): [number, number, number, number] {
    const cfg = getDriver()?.config?.[IMAGE_MASK];
    if (cfg?.values) {
      const cat = cfg.values.find((v: any) => v.id === categoryId);
      if (cat?.color) {
        return parseHexColor(cat.color);
      }
    }
    // No category found — use a light grey with low opacity
    return [180, 180, 180, 80];
  }

  /** Parse a hex color string like "#ff0000" or "#ff0000ff" to [r, g, b, a]. */
  function parseHexColor(hex: string): [number, number, number, number] {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) : HIGHLIGHT_ALPHA;
    return [r, g, b, a];
  }

  function scheduleRedraw(): void {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => redraw());
  }

  // ─── Pan/zoom handlers ──────────────────────────────────────────────────

  export function onDragStart(): void {
    isDragging = true;
    if (!canvasEl) return;
    const t = viewport.workspace.transform;
    canvasEl.style.transform = `scale(${t.scale}) translate(${t.translate[0]}px, ${t.translate[1]}px)`;
    canvasEl.style.transformOrigin = "top left";
  }

  export function onDragEnd(): void {
    isDragging = false;
    if (!canvasEl) return;
    canvasEl.style.transform = "";
    scheduleRedraw();
  }

  export function requestRedraw(): void {
    scheduleRedraw();
  }

  // ─── Reactive redraws ───────────────────────────────────────────────────

  // Session mode changes (via $state — called infrequently)
  $effect(() => {
    maskSession.mode;
    if (!isDragging && ctx) scheduleRedraw();
  });

  // Redraw on viewport transform changes (pan/zoom)
  $effect(() => {
    const t = viewport.workspace.transform;
    t.scale;
    t.translate[0];
    t.translate[1];
    if (ctx) {
      // During drag, use CSS transform; after drag, the settle handles it.
      // For programmatic zoom (wheel), redraw directly.
      if (!isDragging) scheduleRedraw();
    }
  });

  // Redraw on viewport resize
  $effect(() => {
    const [w, h] = viewport.workspace.dimensions;
    if (w > 0 && h > 0 && ctx) {
      resizeCanvas();
      scheduleRedraw();
    }
  });

  // Redraw when annotation list changes, values change, selection changes,
  // hidden/locked state toggles, or render mode toggles.
  $effect(() => {
    data.annotations?.items.length;
    data.annotations?.items;
    // Track selection changes (affects alpha for selected vs unselected masks)
    const selId = selection.value?.id;
    // Track render-mode changes so toggling nearest-neighbour / bilinear
    // triggers an immediate redraw.
    const renderMode = ui.renderMode;
    // Also trigger when annotation values or shape change (e.g. category assigned,
    // tiles flushed via setShape)
    const items = data.annotations?.items ?? [];
    const valueKeys = items.map((a) => `${a.id}:${JSON.stringify(a.value)}`).join(",");
    // Track shape data (tile keys + RLE content) for mask annotations so
    // that flush/undo/redo of tiles triggers a redraw.
    const shapeKeys = items
      .filter((a) => (a.shape as any)?.type === IMAGE_MASK)
      .map((a) => {
        const shape = a.shape as Record<string, unknown>;
        const tileEntries = Object.entries(shape)
          .filter(([k]) => k.startsWith("tile-"))
          .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
          .sort()
          .join(",");
        return `${a.id}:${tileEntries}`;
      })
      .join("|");
    // Track hidden/locked state for each mask annotation so toggling visibility
    // triggers a redraw even without canvas interaction.
    const hiddenKeys = items
      .filter((a) => (a.shape as any)?.type === IMAGE_MASK)
      .map((a) => `${a.id}:h=${annotation.isHidden(a)}:l=${annotation.isLocked(a)}`)
      .join(",");
    if (ctx) scheduleRedraw();
  });
</script>

{#if visible}
  <canvas
    bind:this={canvasEl}
    class="mask-canvas-layer"
    style:position="absolute"
    style:top="0"
    style:left="0"
    style:pointer-events="none"
    style:width="100%"
    style:height="100%"
    role="img"
    aria-label="Mask annotations overlay"
  />
{/if}

<style>
  .mask-canvas-layer {
    z-index: 1;
  }
</style>
