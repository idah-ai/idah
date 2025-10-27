<script lang="ts">
  import { MousePointer2, RedoIcon, SquareDashedIcon, UndoIcon } from "@lucide/svelte";

  import CommandManager from "@/command/CommandManager";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";

  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";

  // Props
  interface Props {
    mode: string;
    onSelectMode: (selectedMode: string) => void;
  }
  let { mode, onSelectMode }: Props = $props();

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
      icon: SquareDashedIcon,
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

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each tools as { label, type, icon: Icon, handleClick }, toolIndex (toolIndex)}
    <Tooltips align="center" delayDuration={100}>
      {#snippet trigger()}
        <Button variant={mode === type ? "default" : "ghost"} size="icon-sm" onclick={handleClick}>
          <Icon />
        </Button>
      {/snippet}

      {#snippet content()}
        {label}
      {/snippet}
    </Tooltips>
  {/each}

  <Separator orientation="vertical"></Separator>

  {#each commands as { label, icon: Icon, handleClick }, commandIndex (commandIndex)}
    <Tooltips align="center" delayDuration={100}>
      {#snippet trigger()}
        <Button variant="ghost" size="icon-sm" onclick={handleClick}>
          <Icon />
        </Button>
      {/snippet}

      {#snippet content()}
        {label}
      {/snippet}
    </Tooltips>
  {/each}
</div>
