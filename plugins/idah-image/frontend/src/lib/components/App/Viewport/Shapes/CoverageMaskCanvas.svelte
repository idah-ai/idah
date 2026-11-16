<script lang="ts">
  // ---------------------------------------------------------------------------
  // CoverageMaskCanvas.svelte — Canvas overlay for coverage mask tile rendering
  //
  // Subscribes to session.onChange and redraws tiles onto an HTMLCanvasElement.
  // Painted pixels are drawn green at 25% opacity.
  //
  // Performance (same approach as MaskCanvasLayer):
  //   - Each tile is rasterized once into an ImageBitmap (rasterizeTile) and
  //     cached with the session's per-tile version; only tiles whose version
  //     changed are re-rasterized.
  //   - A frame is one drawImage per visible tile; off-screen tiles are skipped.
  //   - Redraws are batched to one per animation frame.
  // ---------------------------------------------------------------------------
  import { onMount, onDestroy } from "svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { MASK_TILE_SIZE } from "$lib/mask/constants";
  import { rasterizeTile } from "$lib/mask/rasterize-tile";
  import { session } from "$lib/mask/coverage-mask-session";

  /** rgba(0, 180, 80, 0.25) */
  const COVERAGE_COLOR: [number, number, number, number] = [0, 180, 80, 64];

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let _resizeObserver: ResizeObserver | undefined;
  let _unsubSession: (() => void) | undefined;
  let _redrawScheduled = false;

  /** Cached bitmap per tile key ("col:row"), with the version it was built from. */
  const _bitmaps = new Map<string, { version: number; bitmap: ImageBitmap }>();

  function scheduleRedraw(): void {
    if (_redrawScheduled) return;
    _redrawScheduled = true;
    requestAnimationFrame(() => {
      _redrawScheduled = false;
      redraw();
    });
  }

  /** Bring the bitmap cache in line with the session: rebuild changed tiles, drop removed ones. */
  function syncBitmaps(): void {
    for (const key of session.tileKeys()) {
      const version = session.getTileVersion(key);
      const cached = _bitmaps.get(key);
      if (cached && cached.version === version) continue;
      const [col, row] = key.split(":").map(Number);
      const buffer = session.getTileBuffer(col, row);
      if (!buffer) continue;
      cached?.bitmap.close();
      _bitmaps.set(key, { version, bitmap: rasterizeTile(buffer, COVERAGE_COLOR) });
    }
    for (const [key, cached] of _bitmaps) {
      const [col, row] = key.split(":").map(Number);
      if (!session.getTileBuffer(col, row)) {
        cached.bitmap.close();
        _bitmaps.delete(key);
      }
    }
  }

  function redraw(): void {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    const step = getDriver()?.workflowStep;
    if (step === "done" || step === "error") return;
    if (!ui.coverageMaskVisible) return;

    syncBitmaps();

    const t = viewport.workspace.transform;
    const scale = t.scale;
    const [tx, ty] = t.translate;
    ctx.setTransform(scale, 0, 0, scale, tx, ty);
    ctx.imageSmoothingEnabled = false;

    // Visible area in image pixels, for skipping off-screen tiles
    const minX = -tx / scale;
    const minY = -ty / scale;
    const maxX = (canvasEl.width - tx) / scale;
    const maxY = (canvasEl.height - ty) / scale;

    for (const [key, { bitmap }] of _bitmaps) {
      const [col, row] = key.split(":").map(Number);
      const x = col * MASK_TILE_SIZE;
      const y = row * MASK_TILE_SIZE;
      if (x > maxX || y > maxY || x + MASK_TILE_SIZE < minX || y + MASK_TILE_SIZE < minY) continue;
      ctx.drawImage(bitmap, x, y, MASK_TILE_SIZE, MASK_TILE_SIZE);
    }
  }

  function resizeCanvas(): void {
    if (!canvasEl) return;
    const [vw, vh] = viewport.workspace.dimensions;
    if (vw <= 0 || vh <= 0) return;
    if (canvasEl.width === vw && canvasEl.height === vh) return;
    canvasEl.width = vw;
    canvasEl.height = vh;
    scheduleRedraw();
  }

  onMount(() => {
    resizeCanvas();
    _resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (canvasEl) _resizeObserver.observe(canvasEl);
    // Redraw whenever the session changes
    _unsubSession = session.onChange(() => scheduleRedraw());
    scheduleRedraw();
  });

  // Redraw on viewport transform changes (pan/zoom) and visibility toggles
  $effect(() => {
    const t = viewport.workspace.transform;
    t.scale;
    t.translate[0];
    t.translate[1];
    ui.coverageMaskVisible;
    scheduleRedraw();
  });

  onDestroy(() => {
    _resizeObserver?.disconnect();
    _unsubSession?.();
    for (const { bitmap } of _bitmaps.values()) bitmap.close();
    _bitmaps.clear();
  });
</script>

<canvas
  bind:this={canvasEl}
  width={viewport.workspace.dimensions[0]}
  height={viewport.workspace.dimensions[1]}
  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
