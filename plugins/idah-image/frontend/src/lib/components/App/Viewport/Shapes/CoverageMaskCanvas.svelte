<script lang="ts">
  // ---------------------------------------------------------------------------
  // CoverageMaskCanvas.svelte — Canvas overlay for coverage mask tile rendering
  //
  // Subscribes to session.onChange and redraws tiles onto an HTMLCanvasElement.
  // Each non-empty tile pixel is drawn as green at 25% opacity.
  // ---------------------------------------------------------------------------
  import { onMount, onDestroy } from "svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { MASK_TILE_SIZE } from "$lib/mask/constants";
  import { decode } from "$lib/mask/rle";
  import { session } from "$lib/mask/coverage-mask-session";

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let _resizeObserver: ResizeObserver | undefined;
  let _unsubSession: (() => void) | undefined;

  function redraw(): void {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d")!;
    const w = canvasEl.width;
    const h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);

    const t = viewport.workspace.transform;
    ctx.save();
    ctx.setTransform(t.scale, 0, 0, t.scale, t.translate[0], t.translate[1]);

    const entries = session.getAllTileEntries();
    ctx.fillStyle = "rgba(0, 180, 80, 0.25)";

    for (const { col, row, rle } of entries) {
      const originX = col * MASK_TILE_SIZE;
      const originY = row * MASK_TILE_SIZE;
      const buffer = decode(rle, MASK_TILE_SIZE, MASK_TILE_SIZE);

      for (let py = 0; py < MASK_TILE_SIZE; py++) {
        const rowStart = py * MASK_TILE_SIZE;
        for (let px = 0; px < MASK_TILE_SIZE; px++) {
          if (buffer[rowStart + px] !== 0) {
            ctx.fillRect(originX + px, originY + py, 1, 1);
          }
        }
      }
    }

    ctx.restore();
  }

  function resizeCanvas(): void {
    if (!canvasEl) return;
    const [vw, vh] = viewport.workspace.dimensions;
    if (vw <= 0 || vh <= 0) return;
    canvasEl.width = vw;
    canvasEl.height = vh;
  }

  onMount(() => {
    resizeCanvas();
    _resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (canvasEl) _resizeObserver.observe(canvasEl);
    // Redraw whenever the session changes
    _unsubSession = session.onChange(() => redraw());
  });

  onDestroy(() => {
    _resizeObserver?.disconnect();
    _unsubSession?.();
  });
</script>

<canvas
  bind:this={canvasEl}
  width={viewport.workspace.dimensions[0]}
  height={viewport.workspace.dimensions[1]}
  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>