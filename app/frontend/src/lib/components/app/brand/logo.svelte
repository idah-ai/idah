<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "@/utils";

  let { class: className }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class={cn("bg-primary text-primary-foreground rounded-sm px-2 py-0.5 font-semibold", className)}>IDAH</div>
