// ---------------------------------------------------------------------------
// AnnotationGeometry.svelte — routes to the correct shape renderer
// ---------------------------------------------------------------------------
<script lang="ts">
  import { IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON } from "$lib/plugin/type";
  import BoundingBoxShape from "./BoundingBoxShape.svelte";
  import PolygonShape from "./PolygonShape.svelte";

  let { annotation, selected = false, onClick }: { annotation: any; selected?: boolean; onClick?: any } = $props();
</script>

{#if annotation?.shape?.type === IDAH_VIDEO_BOUNDING_BOX}
  <BoundingBoxShape {annotation} {selected} {onClick} />
{:else if annotation?.shape?.type === IDAH_VIDEO_POLYGON}
  <PolygonShape {annotation} {selected} {onClick} />
{/if}
