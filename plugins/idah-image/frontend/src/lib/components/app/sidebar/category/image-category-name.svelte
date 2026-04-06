<script lang="ts">
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "$lib/components/ui/tooltip";

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
