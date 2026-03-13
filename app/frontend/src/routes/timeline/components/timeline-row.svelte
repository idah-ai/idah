<script lang="ts">
  import type { Snippet } from "svelte";

  // Props
  interface Props {
    children: Snippet;
  }
  let { children, ...restProps }: Props = $props();
</script>

<div id="timeline-row" class="hover:bg-secondary last:border-b hover:cursor-pointer" {...restProps}>
  {@render children()}
</div>
