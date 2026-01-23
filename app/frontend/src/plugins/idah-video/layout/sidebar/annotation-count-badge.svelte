<script lang="ts">
  import type { Snippet } from "svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { cn } from "@/utils";

  // Props
  interface Props {
    class?: string | null;
    children: Snippet;
  }
  let { class: className, children }: Props = $props();
</script>

<Badge variant="gray" rounded="full" class={cn("ml-auto text-[0.625rem]", className)}>
  {@render children()}
</Badge>
