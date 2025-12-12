<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { truncate } from "@/utils/string";

  // Props
  interface Props {
    name: string;
  }
  let { name }: Props = $props();
</script>

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <Button variant="ghost" size="sm">
        {truncate(name, 80)}
      </Button>
    </TooltipTrigger>

    <TooltipContent>
      {name}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
