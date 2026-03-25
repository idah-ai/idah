<script lang="ts">
  import type { Snippet } from "svelte";

  import Text from "$lib/components/ui/text/Text.svelte";

  // Props
  interface Props {
    children?: Snippet;
  }
  let { children }: Props = $props();
</script>

<Text size="xs" class="text-muted-foreground">
  {@render children?.()}
</Text>
