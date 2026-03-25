<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronRightIcon } from "@lucide/svelte";

  import type { PaginationButtonProps } from "$lib/app/button/button.types";

  let { value, parent }: PaginationButtonProps = $props();
</script>

<Button
  href={value?.href}
  variant="outline"
  class="flex-1 flex w-full h-auto hover:cursor-pointer justify-between p-3"
>
  <div class="flex flex-col gap-1">
    {#if parent}
      <div class="text-xs text-muted-foreground">{parent}</div>
    {/if}
    <span class="font-medium leading-tight"> {value?.label} </span>
  </div>
  <div class="flex gap-2">
    <span class="text-xs text-muted-foreground"> Next </span>
    <ChevronRightIcon class="h-4 w-4 shrink-0" />
  </div>
</Button>
