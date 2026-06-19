<script lang="ts">
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "$lib/components/ui/Tooltip";

  // Props
  interface Props {
    name: string;
  }
  let { name }: Props = $props();

  // Variables
</script>

<TooltipProvider ignoreNonKeyboardFocus>
  <Tooltip>
    <TooltipTrigger class="truncate">
      {name}
    </TooltipTrigger>

    <TooltipContent>{name}</TooltipContent>
  </Tooltip>
</TooltipProvider>
