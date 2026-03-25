<script lang="ts">
  import type { Snippet } from "svelte";

  import { TIMELINE_ROW_HEADER_WIDTH } from "$lib/plugin/video-annotation-activity/timeline/store";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>

<div
  id="timeline-row-header"
  class="group/timeline-row-header flex h-9 items-center border-r px-2 py-1"
  style:width="{TIMELINE_ROW_HEADER_WIDTH}px"
  style:min-width="{TIMELINE_ROW_HEADER_WIDTH}px"
  style:max-width="{TIMELINE_ROW_HEADER_WIDTH}px"
>
  {@render children()}
</div>
