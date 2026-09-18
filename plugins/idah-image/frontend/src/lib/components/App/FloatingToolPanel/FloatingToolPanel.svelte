<script lang="ts">
  // -------------------------------------------------------------------------
  // FloatingToolPanel.svelte — Tool-agnostic draggable panel shell.
  //
  // Owns everything chrome: a 6-dot drag grip, pointer-captured dragging,
  // clamping to the container bounds, and position persistence. Visibility and
  // contents come from the `toolPanel` singleton — a tool calls
  // `toolPanel.show(Component)` when it becomes active and `toolPanel.hide()`
  // on deselect. Rendered once by the workspace; it renders nothing when closed.
  // -------------------------------------------------------------------------
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import { tick } from "svelte";

  import { toolPanel } from "$lib/state/tool-panel.svelte";

  interface Props {
    /** The positioned ancestor the panel is absolutely placed within and clamped to. */
    containerEl: HTMLElement | null;
    /** localStorage key for persisting {x, y}. */
    storageKey?: string;
  }

  let { containerEl, storageKey = "idah-image:tool-panel-pos" }: Props = $props();

  /** Fraction of the container height the panel's centre sits at when it has no saved position. */
  const INITIAL_VERTICAL_RATIO = 1 / 3;

  function loadPos(): { x: number; y: number } | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return { x: parsed.x, y: parsed.y };
      }
    } catch {
      // ignore malformed storage
    }
    return null;
  }

  // The user's last dragged position, or null while they have never moved the panel. A plain `let`,
  // not `$state`: it is only read from the placement effect, which must not re-run when it changes.
  let savedPos: { x: number; y: number } | null = loadPos();

  let pos = $state({ x: 0, y: 0 });
  let panelEl = $state<HTMLElement | null>(null);
  // False until the panel has been measured and placed — it renders invisible until then.
  let placed = $state(false);

  // Per-gesture drag bookkeeping.
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  /** Keep the panel fully inside the container, accounting for its own size. */
  function clamp(x: number, y: number): { x: number; y: number } {
    if (!containerEl) return { x, y };
    const c = containerEl.getBoundingClientRect();
    const p = panelEl?.getBoundingClientRect();
    const maxX = Math.max(0, c.width - (p?.width ?? 0));
    const maxY = Math.max(0, c.height - (p?.height ?? 0));
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }

  // Place the panel once it has rendered and can be measured: restore the user's saved position, or
  // centre it horizontally in the upper third so the popup is noticed. Everything runs inside the
  // `tick()` callback so those reads are untracked — the effect depends on `toolPanel.open` alone.
  $effect(() => {
    if (!toolPanel.open) {
      placed = false;
      return;
    }

    tick().then(() => {
      if (!panelEl || !containerEl) return;
      const c = containerEl.getBoundingClientRect();
      const p = panelEl.getBoundingClientRect();
      const target = savedPos ?? {
        x: (c.width - p.width) / 2,
        y: c.height * INITIAL_VERTICAL_RATIO - p.height / 2,
      };
      pos = clamp(target.x, target.y);
      placed = true;
    });
  });

  function onGripDown(e: PointerEvent): void {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originX = pos.x;
    originY = pos.y;
    // Route every subsequent move/up to the grip, even over the canvas or SVG shapes.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onGripMove(e: PointerEvent): void {
    if (!dragging) return;
    pos = clamp(originX + (e.clientX - startX), originY + (e.clientY - startY));
  }

  function onGripUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    savedPos = { ...pos };
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }
</script>

{#if toolPanel.open && toolPanel.component && containerEl}
  {@const Comp = toolPanel.component}
  <div
    bind:this={panelEl}
    class="border-border bg-background absolute z-50 flex items-stretch gap-1 rounded-lg border shadow-lg select-none"
    class:invisible={!placed}
    style:left="{pos.x}px"
    style:top="{pos.y}px"
  >
    <!-- 6-dot grip: the only element that starts a drag -->
    <button
      type="button"
      aria-label="Move panel"
      class="text-muted-foreground hover:text-foreground flex cursor-grab touch-none items-center rounded-l-lg px-1 active:cursor-grabbing"
      onpointerdown={onGripDown}
      onpointermove={onGripMove}
      onpointerup={onGripUp}
    >
      <GripVerticalIcon class="size-4" />
    </button>

    <div class="flex items-center gap-3 py-2 pr-3">
      <Comp {...toolPanel.props} />
    </div>
  </div>
{/if}
