<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronLeftIcon } from "@lucide/svelte";

  import type { PaginationButtonProps } from "$lib/app/button/button.types";

  let { value }: PaginationButtonProps = $props();
  $effect(() => {
    console.log(value);
  });
</script>

<Button
  href={value?.href}
  variant="outline"
  class="flex-1 flex justify-between w-full h-auto items-center hover:cursor-pointer"
>
  <ChevronLeftIcon />

  <div class="flex flex-col items-end p-1">
    <span class="text-xs text-muted-foreground"> Previous </span>
    <span class="font-medium leading-tight"> {value?.label} </span>
  </div>
</Button>
