// ---------------------------------------------------------------------------
// ShapeContainer.svelte — renders all visible annotations for the current frame
// ---------------------------------------------------------------------------
<script lang="ts">
  import { data } from "$lib/state/data.svelte";
  import { viewport } from "$lib/state/viewport.svelte";
  import { selection } from "$lib/state/selection.svelte";
  import type { IAnnotationRecord } from "$idah/v2/types";
  import AnnotationGeometry from "./AnnotationGeometry.svelte";

  /** Annotations that are visible on the current frame. */
  let visibleAnnotations = $derived.by<IAnnotationRecord[]>(() => {
    const frame = viewport.video.currentFrame.value;
    const items = data.annotations?.items ?? [];
    return items.filter((ann) => {
      const s = ann.shape as { start?: number; end?: number };
      return s.start != null && s.end != null && frame >= s.start && frame <= s.end;
    });
  });

  function handleClick(ann: IAnnotationRecord) {
    if (selection.value?.type === "annotation" && selection.value.annotation?.id === ann.id) return;
    selection.selectAnnotation(ann);
  }
</script>

{#each visibleAnnotations as ann (ann.id)}
  <AnnotationGeometry
    annotation={ann}
    selected={selection.value?.type === "annotation" && selection.value.annotation?.id === ann.id}
    onClick={() => handleClick(ann)}
  />
{/each}
