<script lang="ts">
  import { RedoIcon, UndoIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";

  import { getShortcut } from "@/components/ui/kbd/utils";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { IToolbarItem } from "@/plugin/v2/types";
  import type { AnnotationHeaderBarBaseTool } from "./annotation-header-bar.types";

  // Props
  interface Props {
    driver: IdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  const disabledToolsIfWorkflowSteps = ["done"];
  let currentMode = $state(driver.mode);
  let toolbarItems: IToolbarItem[] = $derived.by(() => driver.toolbarMgr.getItemsForMode(currentMode));
  let canUndo = $state(driver.command.canUndo());
  let canRedo = $state(driver.command.canRedo());

  function refreshToolbar() {
    currentMode = driver.mode;
    canUndo = driver.command.canUndo();
    canRedo = driver.command.canRedo();
  }

  driver.onModeChange((_) => refreshToolbar());
  driver.onSyncChange(() => refreshToolbar());
  onMount(refreshToolbar);

  const commands: AnnotationHeaderBarBaseTool[] = $derived([
    {
      name: "undo",
      label: "Undo",
      icon: UndoIcon,
      disabled: !canUndo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.undo(),
    },
    {
      name: "redo",
      label: "Redo",
      icon: RedoIcon,
      disabled: !canRedo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.redo(),
    },
  ]);
</script>

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each toolbarItems as { icon, label, mode, onClick, visibleWhen, whenToggled }, toolIndex (toolIndex)}
    <ToolTooltip
      {label}
      shortcut={getShortcut(driver.command.getShortcutReferences()?.[mode]?.keyCombinations)}
      align="center"
      delayDuration={100}
    >
      {#snippet trigger()}
        {#if visibleWhen?.() || true}
          <Button
            variant={whenToggled?.() || false ? "default" : "ghost"}
            size="icon-sm"
            onclick={onClick}
            disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
          >
            {console.log({ mode, currentMode, variant: currentMode === mode ? "default" : "ghost", toolbarItems })}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html icon}
          </Button>
        {/if}
      {/snippet}
    </ToolTooltip>
  {/each}

  <Separator orientation="vertical"></Separator>

  {#each commands as { name, label, icon: Icon, disabled, handleClick }, commandIndex (commandIndex)}
    <ToolTooltip
      {label}
      shortcut={getShortcut(driver.command.getShortcutReferences()?.[name]?.keyCombinations)}
      align="center"
      delayDuration={100}
    >
      {#snippet trigger()}
        <Button variant="ghost" size="icon-sm" {disabled} onclick={handleClick}>
          <Icon />
        </Button>
      {/snippet}
    </ToolTooltip>
  {/each}
</div>
