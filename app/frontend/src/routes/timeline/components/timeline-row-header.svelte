<script lang="ts">
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>

<div
  id="timeline-row-header"
  class="group/timeline-row-header flex h-9 w-80 max-w-80 min-w-80 items-center border-r px-2 py-1"
>
  {@render children()}
</div>
