<script lang="ts">
  // ---------------------------------------------------------------------------
  // CoverageMaskCanvas.svelte — Canvas overlay for coverage mask tile rendering
  //
  // Subscribes to session.onChange and redraws the Done Area onto an
  // HTMLCanvasElement as a light green fill with diagonal hatching (////), so it
  // reads as a status overlay rather than a solid mask annotation.
  //
  // How a frame is drawn:
  //   1. Each visible tile's opaque mask bitmap is drawn onto an offscreen canvas
  //      at whole screen pixels, so neighbouring tiles meet without seams.
  //   2. `source-in` fills that mask with the hatch pattern: the fill colour and
  //      the stripes come from one small pattern tile, in screen pixels, so the
  //      stripes keep the same width and spacing at every zoom.
  //   3. The result is copied onto the visible canvas with one drawImage.
  //
  // Performance (same approach as MaskCanvasLayer):
  //   - Each tile is rasterized once into an ImageBitmap (rasterizeTile) and
  //     cached with the session's per-tile version; only tiles whose version
  //     changed are re-rasterized.
  //   - A frame is one drawImage per visible tile, one pattern fill and one
  //     full-canvas drawImage; off-screen tiles are skipped.
  //   - Redraws are batched to one per animation frame.
  // ---------------------------------------------------------------------------
  import { onMount, onDestroy } from "svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { ui } from "$lib/state/ui.svelte";
  import { getDriver } from "$lib/state/driver.svelte";
  import { MASK_TILE_SIZE } from "$lib/mask/constants";
  import { rasterizeTile } from "$lib/mask/rasterize-tile";
  import { session } from "$lib/mask/coverage-mask-session";

  /** Tile bitmaps are plain opaque masks; colour comes from the hatch pattern. */
  const MASK_COLOR: [number, number, number, number] = [255, 255, 255, 255];
  /** Base fill of the Done Area: rgba(0, 180, 80, 0.25), as before. */
  const FILL_COLOR = "rgba(0, 180, 80, 0.25)";
  /** Hatch stripe colour, drawn over the fill inside the pattern tile. */
  const STRIPE_COLOR = "rgba(120, 255, 160, 0.55)";
  /** Hatch period in screen pixels (one 1px "/" stripe per period). */
  const HATCH_SIZE = 8;

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let _resizeObserver: ResizeObserver | undefined;
  let _unsubSession: (() => void) | undefined;
  let _redrawScheduled = false;

  /** Offscreen canvas the mask is assembled and hatched on before compositing. */
  let _maskCanvas: OffscreenCanvas | undefined;
  let _hatch: CanvasPattern | null = null;

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
      _bitmaps.set(key, { version, bitmap: rasterizeTile(buffer, MASK_COLOR) });
    }
    for (const [key, cached] of _bitmaps) {
      const [col, row] = key.split(":").map(Number);
      if (!session.getTileBuffer(col, row)) {
        cached.bitmap.close();
        _bitmaps.delete(key);
      }
    }
  }

  /**
   * One HATCH_SIZE × HATCH_SIZE pattern tile: the base fill with a 1px "/" stripe
   * drawn pixel by pixel (no anti-aliasing), which repeats into unbroken lines.
   */
  function makeHatchTile(): OffscreenCanvas {
    const tile = new OffscreenCanvas(HATCH_SIZE, HATCH_SIZE);
    const tctx = tile.getContext("2d")!;
    tctx.fillStyle = FILL_COLOR;
    tctx.fillRect(0, 0, HATCH_SIZE, HATCH_SIZE);
    tctx.fillStyle = STRIPE_COLOR;
    for (let i = 0; i < HATCH_SIZE; i++) tctx.fillRect(i, HATCH_SIZE - 1 - i, 1, 1);
    return tile;
  }

  /** The offscreen mask canvas at the visible canvas's size (created on first use). */
  function maskContext(width: number, height: number): OffscreenCanvasRenderingContext2D {
    if (!_maskCanvas) _maskCanvas = new OffscreenCanvas(width, height);
    if (_maskCanvas.width !== width || _maskCanvas.height !== height) {
      _maskCanvas.width = width;
      _maskCanvas.height = height;
    }
    const mctx = _maskCanvas.getContext("2d")!;
    if (!_hatch) _hatch = mctx.createPattern(makeHatchTile(), "repeat");
    return mctx;
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
    if (_bitmaps.size === 0) return;

    const t = viewport.workspace.transform;
    const scale = t.scale;
    const [tx, ty] = t.translate;
    // Screen pixels (identity transform): each tile edge is rounded to a whole
    // pixel, so neighbouring tiles share that edge exactly.
    const toScreenX = (px: number) => Math.round(tx + px * scale);
    const toScreenY = (px: number) => Math.round(ty + px * scale);

    // Visible area in image pixels, for skipping off-screen tiles
    const minX = -tx / scale;
    const minY = -ty / scale;
    const maxX = (canvasEl.width - tx) / scale;
    const maxY = (canvasEl.height - ty) / scale;

    const mctx = maskContext(canvasEl.width, canvasEl.height);
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    mctx.imageSmoothingEnabled = false;

    // 1. Opaque mask of the visible tiles
    let drawn = 0;
    for (const [key, { bitmap }] of _bitmaps) {
      const [col, row] = key.split(":").map(Number);
      const x = col * MASK_TILE_SIZE;
      const y = row * MASK_TILE_SIZE;
      if (x > maxX || y > maxY || x + MASK_TILE_SIZE < minX || y + MASK_TILE_SIZE < minY) continue;
      const sx = toScreenX(x);
      const sy = toScreenY(y);
      mctx.drawImage(bitmap, sx, sy, toScreenX(x + MASK_TILE_SIZE) - sx, toScreenY(y + MASK_TILE_SIZE) - sy);
      drawn++;
    }
    if (drawn === 0) return;

    // 2. Colour the mask with the fill + hatch. The pattern is anchored to the
    //    image origin (whole pixels), so stripes move with the image when panning.
    mctx.globalCompositeOperation = "source-in";
    if (_hatch) {
      _hatch.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(tx), Math.round(ty)]));
      mctx.fillStyle = _hatch;
    } else {
      mctx.fillStyle = FILL_COLOR;
    }
    mctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    mctx.globalCompositeOperation = "source-over";

    // 3. Composite onto the visible canvas
    ctx.drawImage(_maskCanvas!, 0, 0);
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
    _maskCanvas = undefined;
    _hatch = null;
  });
</script>

<canvas
  bind:this={canvasEl}
  width={viewport.workspace.dimensions[0]}
  height={viewport.workspace.dimensions[1]}
  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
