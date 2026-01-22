<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronLeftIcon } from "@lucide/svelte";
</script>

<Button variant="outline" class="flex-1 flex justify-between w-full h-auto items-center hover:cursor-pointer">
  <ChevronLeftIcon />

  <div class="flex flex-col items-end p-1">
    <span class="text-xs text-muted-foreground"> Previous </span>
    <span class="font-medium leading-tight"> Getting Started with IDAH </span>
  </div>
</Button>
