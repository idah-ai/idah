<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import CommandManager from "@/command/CommandManager";
  import Separator from "@/components/ui/separator/separator.svelte";
  import { MousePointer2, RedoIcon, UndoIcon, BoxSelectIcon } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";

  // Props
  interface Props {
    mode: string;
    onSelectMode: (selectedMode: string) => void;
  }
  let { mode = $bindable(), onSelectMode }: Props = $props();

  // Variables
  interface HeaderBarModeTool extends AnnotationHeaderBarBaseTool {
    type: string;
  }

  const tools: HeaderBarModeTool[] = [
    {
      label: "Visual",
      type: "visual",
      icon: MousePointer2,
      handleClick: () => {
        mode = "visual";
        onSelectMode("visual");
      },
    },
    {
      label: "Bounding Box",
      type: "video:bounding_box",
      icon: BoxSelectIcon,
      handleClick: () => {
        mode = "video:bounding_box";
        onSelectMode("video:bounding_box");
      },
    },
  ];

  const commands: AnnotationHeaderBarBaseTool[] = [
    {
      label: "Undo",
      icon: UndoIcon,
      handleClick: () => {
        CommandManager.undo();
      },
    },
    {
      label: "Redo",
      icon: RedoIcon,
      handleClick: () => {
        CommandManager.redo();
      },
    },
  ];
</script>

<div id="annotation-header-bar-tools" class="flex h-full flex-1 items-center gap-1">
  {#each tools as { label, type, icon: Icon, handleClick }}
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger>
          <Button variant={mode === type ? "default" : "ghost"} size="icon" onclick={handleClick}>
            <Icon class="size-4" />
          </Button>
        </TooltipTrigger>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  {/each}

  <Separator orientation="vertical" />

  {#each commands as { label, icon: Icon, handleClick }}
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
