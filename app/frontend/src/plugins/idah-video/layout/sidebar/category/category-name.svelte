<script lang="ts">
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>

<div class="truncate whitespace-nowrap">
  {@render children()}
</div>
