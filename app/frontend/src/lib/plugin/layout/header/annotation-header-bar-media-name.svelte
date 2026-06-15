<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { truncate } from "@/utils/string";

  // Props
  interface Props {
    name: string;
  }
  let { name = "" }: Props = $props();
</script>

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger class="max-w-full min-w-0 overflow-hidden">
      <Button variant="ghost" size="sm" class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
        <span class="overflow-hidden text-ellipsis">
          {truncate(name, 80)}
        </span>
      </Button>
    </TooltipTrigger>

    <TooltipContent>
      <p class="max-w-md break-all">{name}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
