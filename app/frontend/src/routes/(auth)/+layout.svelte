<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import type { WithElementRef } from "@/utils";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
  <div class="flex w-full max-w-sm flex-col gap-6">
    {@render children?.()}
  </div>
</div>
