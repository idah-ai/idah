<script lang="ts">
  import { getDriver } from "$lib/state/driver.svelte";
  import { activeNoteId, data, notes, pendingNoteScene, setPendingNoteScene } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import { annotation } from "$lib/state/annotation.svelte";
  import type { INoteRecord } from "$idah/v2/types";
  import { NOTE_MODE, type IImageAnnotationShape } from "$lib/types";
  import { onMount } from "svelte";

  let isNoteMode = $derived(viewport.mode === NOTE_MODE);

  let svgRect = $state<DOMRect | null>(null);

  function sceneToScreen(sx: number, sy: number): { x: number; y: number } {
    const { translate, scale } = viewport.workspace.transform;
    return {
      x: sx * scale + translate[0] + (svgRect?.left ?? 0),
      y: sy * scale + translate[1] + (svgRect?.top ?? 0),
    };
  }

  let invScale = $derived(1 / viewport.workspace.transform.scale);

  function noteScenePosition(note: INoteRecord): { x: number; y: number } | null {
    if (note.anchor.anchor_type === "entry") {
      const pos = note.anchor.position as { x?: number; y?: number } | undefined;
      if (pos?.x == null || pos?.y == null) return null;
      return { x: pos.x * media.width, y: pos.y * media.height };
    }
    if (note.anchor.anchor_type === "annotation") {
      const annId = note.anchor.annotation_id;
      if (!annId) return null;
      const ann = data.annotations?.items?.find(a => a.id === annId);
      if (!ann) return null;
      // Skip markers on hidden annotations
      if (annotation.isHidden(ann)) return null;
      const shape = ann.shape as IImageAnnotationShape | undefined;
      if (!shape || !shape.points?.length) return null;

      // Compute centroid of the annotation shape points
      const points = shape.points;
      const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
      const cy = points.reduce((s, p) => s + p[1], 0) / points.length;

      const pos = note.anchor.position as { x?: number; y?: number } | undefined;
      return {
        x: cx * media.width + (pos?.x ?? 0) * media.width,
        y: cy * media.height + (pos?.y ?? 0) * media.height,
      };
    }
    return null;
  }

  let markers = $derived.by(() => {
    const result: Array<{ note: INoteRecord; x: number; y: number }> = [];
    for (const note of notes.list) {
      const pos = noteScenePosition(note);
      if (pos) result.push({ note, ...pos });
    }
    return result;
  });

  function getSvgScreenOffset(): { left: number; top: number } {
    if (viewport.svgElement) {
      const r = viewport.svgElement.getBoundingClientRect();
      return { left: r.left, top: r.top };
    }
    return { left: 0, top: 0 };
  }

  /** Converts the pending note scene position to scene pixel coords for SVG/screen usage. */
  let pendingNotePixels = $derived.by<{ x: number; y: number } | null>(() => {
    const p = pendingNoteScene.value;
    if (!p) return null;

    if (p.type === "entry") {
      // x/y are normalized (0-1) — convert to scene pixels
      return { x: p.x * media.width, y: p.y * media.height };
    }

    // Annotation: x/y are normalized offset from centroid
    const ann = data.annotations?.items?.find(a => a.id === p.annotationId);
    if (!ann) return null;
    const shape = ann.shape as IImageAnnotationShape | undefined;
    if (!shape || !shape.points?.length) return null;

    const points = shape.points;
    const cx = points.reduce((s, pt) => s + pt[0], 0) / points.length;
    const cy = points.reduce((s, pt) => s + pt[1], 0) / points.length;

    return {
      x: (cx + p.x) * media.width,
      y: (cy + p.y) * media.height,
    };
  });

  // Report position reactively whenever any relevant reactive changes.
  $effect(() => {
    const p = pendingNoteScene.value;
    const a = activeNoteId.value;
    if (!p && !a) return;

    // Touch these so the effect tracks them
    pendingNotePixels;
    markers;
    const { translate, scale } = viewport.workspace.transform;
    const off = getSvgScreenOffset();

    const driver = getDriver();
    if (p) {
      const pixel = pendingNotePixels;
      if (pixel) {
        const screenX = pixel.x * scale + translate[0] + off.left;
        const screenY = pixel.y * scale + translate[1] + off.top;
        driver.notes.reportNotePosition({ noteId: null, x: screenX, y: screenY });
      } else {
        driver.notes.reportNotePosition({ noteId: null });
      }
    } else if (a) {
      const marker = markers.find(m => m.note.id === a);
      if (marker) {
        const screenX = marker.x * scale + translate[0] + off.left;
        const screenY = marker.y * scale + translate[1] + off.top;
        driver.notes.reportNotePosition({ noteId: a, x: screenX, y: screenY });
      } else {
        driver.notes.reportNotePosition({ noteId: a });
      }
    }
  });

  onMount(() => {
    const driver = getDriver();

    // SVG rect for initial offset
    if (viewport.svgElement) {
      svgRect = viewport.svgElement.getBoundingClientRect();
      const ro = new ResizeObserver(() => { svgRect = viewport.svgElement!.getBoundingClientRect(); });
      ro.observe(viewport.svgElement);
    }

    const unsubFocus = driver.notes.onFocusNote((note: INoteRecord | null) => {
      // Clear ghost marker on any focus/deselect event
      setPendingNoteScene(null);

      if (!note) {
        // Null signal — core deselected/cancelled
        activeNoteId.value = null;
        return;
      }

      if (note.anchor.anchor_type === "annotation" && note.anchor.annotation_id) {
        const ann = data.annotations?.items?.find(a => a.id === note.anchor.annotation_id);
        if (ann) {
          selection.selectAnnotation(ann);
          driver.command.call("selection.center");
        } else {
          // Annotations not loaded yet — defer until they are
          const stop = $effect.root(() => {
            $effect(() => {
              const found = data.annotations?.items?.find(a => a.id === note.anchor.annotation_id);
              if (!found) return;
              selection.selectAnnotation(found);
              driver.command.call("selection.center");
              stop();
            });
          });
        }
      } else {
        viewport.workspace.fitToViewport();
      }

      activeNoteId.value = note.id;
      driver.notes.selectNote(note.id);
    });

    return () => {
      unsubFocus();
    };
  });

  function handleMarkerClick(note: INoteRecord, sceneX: number, sceneY: number): void {
    const driver = getDriver();
    // Dismiss any pending (temp) ghost marker
    setPendingNoteScene(null);
    activeNoteId.value = note.id;
    const screen = sceneToScreen(sceneX, sceneY);
    driver.notes.selectNote(note.id);
    driver.notes.reportNotePosition({ noteId: note.id, x: screen.x, y: screen.y });
  }
</script>

<g>
  {#each markers as marker (marker.note.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class:cursor-pointer={!isNoteMode}
      class:cursor-note={isNoteMode}
      class:pointer-events-none={isNoteMode}
      style="transform: translate({marker.x}px, {marker.y - 24 * invScale}px)"
      onclick={() => handleMarkerClick(marker.note, marker.x, marker.y)}
      onkeypress={(e) => { if (e.key === 'Enter') handleMarkerClick(marker.note, marker.x, marker.y); }}
      role="button"
      tabindex="0"
    >
      <title>{marker.note.content_md ?? "Note marker"}</title>
      <g style="transform: scale({invScale}); transform-origin: 0 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md">
          <path
            d="M2.992 16.167a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"
            class:fill-primary={marker.note.status !== "resolved"}
            class:fill-muted-foreground={marker.note.status === "resolved"}
            class="stroke-white stroke-2"
          />
        </svg>
      </g>
    </g>
  {/each}
</g>

{#if pendingNoteScene.value && pendingNotePixels}
  <g style="transform: translate({pendingNotePixels.x}px, {pendingNotePixels.y - 24 * invScale}px)" class="opacity-60 pointer-events-none">
    <g style="transform: scale({invScale}); transform-origin: 0 0;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md">
        <path d="M2.992 16.167a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" class="fill-primary stroke-white stroke-2" />
      </svg>
    </g>
  </g>
{/if}
