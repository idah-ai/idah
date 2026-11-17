<script lang="ts">
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { truncatePath } from "@/utils/string";

  // Props
  interface Props {
    name: string;
  }
  let { name = "" }: Props = $props();
</script>

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger class="max-w-full min-w-0 overflow-hidden">
      <div
        class="text-accent-foreground max-w-full overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap hover:cursor-default"
      >
        {truncatePath(name, 80)}
      </div>
    </TooltipTrigger>

    <TooltipContent>
      <p class="max-w-md break-all">{name}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
