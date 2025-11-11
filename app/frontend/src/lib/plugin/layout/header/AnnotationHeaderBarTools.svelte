<script lang="ts">
  import { RedoIcon, UndoIcon } from "@lucide/svelte";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";

  import { pluginsBackendDataSource } from "@/data/model/setting/plugin/record";
  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { AnnotationHeaderBarBaseTool } from "./AnnotationHeaderBar.types";

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

  // Functions
  async function loadIcon(iconName: string | undefined) {
    if (!iconName) return "";

    const pluginIconRes = await pluginsBackendDataSource.serveAsset("idah-video", `${iconName}.svg`);
    return await pluginIconRes.text();
  }
</script>

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each tools as { label, type, iconName, handleClick }, toolIndex (toolIndex)}
    <Tooltips align="center" delayDuration={100}>
      {#snippet trigger()}
        {#await loadIcon(iconName) then iconSvg}
          <Button variant={mode === type ? "default" : "outline"} size="icon-sm" onclick={handleClick}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html iconSvg}

            <!-- NOTE: We might want to display icon with <img> later after we fix the mime-type from backend -->
            <!-- NOTE: For now lets keep using {@html iconSvg} -->
            <!-- <img src="/api/v1/setting/plugins/idah-video/assets/message-circle.svg" alt={label} /> -->
          </Button>
        {/await}
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
