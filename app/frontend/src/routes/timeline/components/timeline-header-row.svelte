<script lang="ts">
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>

<div id="timeline-header-row" class="relative flex w-full border-b">
  {@render children()}
</div>
