<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronRightIcon } from "@lucide/svelte";

  import type { PaginationButtonProps } from "$lib/app/button/button.types";

  let { value }: PaginationButtonProps = $props();
</script>

<Button
  href={value?.href}
  variant="outline"
  class="flex-1 flex justify-between w-full h-auto items-center hover:cursor-pointer"
>
  <div class="flex flex-col items-start p-1">
    <span class="text-xs text-muted-foreground"> Next </span>
    <span class="font-medium leading-tight"> {value?.label} </span>
  </div>

  <ChevronRightIcon class="h-4 w-4 shrink-0" />
</Button>
