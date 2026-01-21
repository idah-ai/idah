<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronRightIcon } from "@lucide/svelte";
</script>

<Button variant="outline" class="h-auto p-0 w-full">
  <div class="flex items-center gap-3 px-4 py-3 w-full justify-between">
    <div class="flex flex-col items-start">
      <span class="text-xs text-muted-foreground"> Next </span>
      <span class="font-medium leading-tight"> Getting Started with IDAH </span>
    </div>

    <ChevronRightIcon class="h-4 w-4 shrink-0" />
  </div>
</Button>
