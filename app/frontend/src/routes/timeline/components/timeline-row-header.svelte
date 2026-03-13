<script lang="ts">
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children: Snippet;
    width?: number;
  }
  let { children, width = 320 }: Props = $props();
</script>

<div
  id="timeline-row-header"
  class="group/timeline-row-header flex h-9 items-center border-r px-2 py-1"
  style:width="{width}px"
  style:min-width="{width}px"
  style:max-width="{width}px"
>
  {@render children()}
</div>
