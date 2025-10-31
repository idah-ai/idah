<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { RedoIcon, UndoIcon } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";
  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();

  // Variables
  interface HeaderBarModeTool extends AnnotationHeaderBarBaseTool {
    type: string;
  }

  let tools: HeaderBarModeTool[] = $state([]);
  let mode: string | undefined = $state();

  context.tools.onToolsChange((_tools: HeaderBarModeTool[]) => (tools = _tools));
  context.tools.onToolChange((_tool: string) => (mode = _tool));

  const commands: AnnotationHeaderBarBaseTool[] = [
    {
      label: "Undo",
      icon: UndoIcon,
      handleClick: () => context.commands.undo(),
    },
    {
      label: "Redo",
      icon: RedoIcon,
      handleClick: () => context.commands.redo(),
    },
  ];
</script>

<div id="annotation-header-bar-tools" class="flex h-full flex-1 items-center gap-1">
  {#each tools as { label, type, icon: Icon, handleClick } (label)}
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger>
          <Button variant={mode === type ? "default" : "ghost"} size="icon" onclick={() => handleClick()}>
            <!-- <img src="(icon = [plugin, tool_type] path)" alt={label} /> -->
            <!-- <Icon class="size-4" /> -->
          </Button>
        </TooltipTrigger>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  {/each}

  <Separator orientation="vertical" />

  {#each commands as { label, icon: Icon, handleClick } (label)}
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" onclick={handleClick}>
            <Icon class="size-4" />
          </Button>
        </TooltipTrigger>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  {/each}
</div>
