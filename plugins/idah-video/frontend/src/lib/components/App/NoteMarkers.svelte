<script lang="ts">
  import { getDriver } from "$lib/state/driver.svelte";
  import { activeNoteId, data, notes, pendingNoteScene, setPendingNoteScene, focusNote } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { media } from "$lib/state/media.svelte";
  import type { INoteRecord } from "$idah/v2/types";
  import type { IVideoAnnotationShape } from "$lib/types";
  import { centroid as centroidUtil } from "$lib/utils/math/point";
  import { getInterpolatedFrame } from "$lib/utils/interpolation";
  import { onMount } from "svelte";

  let svgRect = $state<DOMRect | null>(null);

  function getSvgScreenOffset(): { left: number; top: number } {
    return svgRect ?? { left: 0, top: 0 };
  }

  let invScale = $derived(1 / viewport.workspace.transform.scale);

  function noteScenePosition(note: INoteRecord): { x: number; y: number } | null {
    const currentFrame = viewport.video.currentFrame.value;
    if (note.anchor.anchor_type === "entry") {
      const pos = note.anchor.position as { frame?: number; x?: number; y?: number } | undefined;
      if (pos && pos.frame !== undefined && pos.frame !== currentFrame) return null;
      if (!pos?.x || !pos?.y) return null // general ?
      return { x: pos.x * media.width, y: pos.y * media.height };
    }
    if (note.anchor.anchor_type === "annotation") {
      const annId = note.anchor.annotation_id;
      if (!annId) return null;
      const ann = data.annotations?.items?.find(a => a.id === annId);
      if (!ann) return null;
      const shape = ann.shape as IVideoAnnotationShape | undefined;
      if (!shape || shape.start == null || shape.end == null) return null;
      if (currentFrame < shape.start || currentFrame > shape.end) return null;
      let centroid: [number, number];
      if (shape.frames && shape.frames.length > 0) {
        const interp = getInterpolatedFrame(shape, currentFrame);
        if (!interp || !interp.points?.length) return null;
        centroid = centroidUtil(interp.points);
      } else {
        return null
        // centroid = [0.5, 0.5];
      }
      const pos = note.anchor.position as { x?: number; y?: number } | undefined;
      return {
        x: centroid[0] * media.width + (pos?.x ?? 0) * media.width,
        y: centroid[1] * media.height + (pos?.y ?? 0) * media.height,
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

  // Report note position reactively — re-runs only when its dependencies change
  $effect(() => {
    const driver = getDriver();
    const { translate, scale } = viewport.workspace.transform;
    const off = getSvgScreenOffset();

    if (pendingNoteScene.value) {
      const sx = pendingNoteScene.value.x;
      const sy = pendingNoteScene.value.y;
      driver.notes.reportNotePosition({
        noteId: null,
        x: sx * scale + translate[0] + off.left,
        y: sy * scale + translate[1] + off.top,
      });
    } else if (activeNoteId.value) {
      const marker = markers.find(m => m.note.id === activeNoteId.value);
      if (marker) {
        driver.notes.reportNotePosition({
          noteId: activeNoteId.value,
          x: marker.x * scale + translate[0] + off.left,
          y: marker.y * scale + translate[1] + off.top,
        });
      } else {
        driver.notes.reportNotePosition({ noteId: activeNoteId.value });
      }
    }
  });

  // Set up ResizeObserver on SVG element and wire onFocusNote
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

      focusNote(note);
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
    const { translate, scale } = viewport.workspace.transform;
    const off = getSvgScreenOffset();
    const screenX = sceneX * scale + translate[0] + off.left;
    const screenY = sceneY * scale + translate[1] + off.top;
    driver.notes.selectNote(note.id);
    driver.notes.reportNotePosition({ noteId: note.id, x: screenX, y: screenY });
  }
</script>

<g>
  {#each markers as marker (marker.note.id)}
    <g
      class="cursor-pointer"
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

{#if pendingNoteScene.value}
  <g style="transform: translate({pendingNoteScene.value.x}px, {pendingNoteScene.value.y - 24 * invScale}px)" class="opacity-60 pointer-events-none">
    <g style="transform: scale({invScale}); transform-origin: 0 0;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md">
        <path d="M2.992 16.167a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" class="fill-primary stroke-white stroke-2" />
      </svg>
    </g>
  </g>
{/if}
