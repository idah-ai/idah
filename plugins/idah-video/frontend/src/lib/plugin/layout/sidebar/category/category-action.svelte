<script lang="ts">
  import type { Snippet } from "svelte";

  import Button from "$lib/components/ui/button/button.svelte";

  import { cn } from "$lib/utils";

  // Props
  interface Props {
    class?: string | null;
    onclick: (e: MouseEvent) => void;
    children: Snippet;
  }
  let { class: className, onclick, children }: Props = $props();
</script>

<Button
  variant="ghost"
  size="icon-sm"
  class={cn("text-muted-foreground shrink-0", className)}
  onclick={(e) => {
    e.stopPropagation();
    onclick(e);
  }}
>
  {@render children()}
</Button>
