<script lang="ts">
  import { RedoIcon, UndoIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";

  import { getShortcutLabel } from "@/components/ui/kbd/utils";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { IToolbarItem } from "@/plugin/v2/types";
  import type { AnnotationHeaderBarBaseTool } from "./annotation-header-bar.types";
  import { SvelteMap } from "svelte/reactivity";

  // Props
  interface Props {
    driver: IdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  const disabledToolsIfWorkflowSteps = ["done"];
  let currentMode = $state(driver.mode);
  let toolbarItems: IToolbarItem[] = $derived.by(() => driver.toolbar.mgr.getItemsForMode(currentMode));
  let toggledMap = $derived.by(() => {
    const map = new SvelteMap<string, boolean>();
    for (const item of toolbarItems) {
      map.set(item.name ?? item.label, item.whenToggled?.() ?? false);
    }
    return map;
  });
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

  function cmdShortcut(name: string): string | undefined {
    const s = driver.command.getShortcut(name);
    return s ? getShortcutLabel(s) : undefined;
  }

  const commands: AnnotationHeaderBarBaseTool[] = $derived([
    {
      name: "core.undo",
      label: "Undo",
      icon: UndoIcon,
      disabled: !canUndo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.undo(),
    },
    {
      name: "core.redo",
      label: "Redo",
      icon: RedoIcon,
      disabled: !canRedo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.redo(),
    },
  ]);
</script>

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each toolbarItems as { icon, label, name, onClick, visibleWhen }, toolIndex (toolIndex)}
    {#if (visibleWhen || (() => true))()}
      {@const isToggled = toggledMap.get(name ?? label) ?? false}
      <ToolTooltip {label} shortcut={name ? cmdShortcut(name) : undefined} align="center" delayDuration={100}>
        {#snippet trigger()}
          <Button
            variant={isToggled ? "default" : "ghost"}
            size="icon-sm"
            onclick={onClick}
            disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html icon}
          </Button>
        {/snippet}
      </ToolTooltip>
    {/if}
  {/each}

  <Separator orientation="vertical"></Separator>

  {#each commands as { name, label, icon: Icon, disabled, handleClick }, commandIndex (commandIndex)}
    <ToolTooltip {label} shortcut={cmdShortcut(name)} align="center" delayDuration={100}>
      {#snippet trigger()}
        <Button variant="ghost" size="icon-sm" {disabled} onclick={handleClick}>
          <Icon />
        </Button>
      {/snippet}
    </ToolTooltip>
  {/each}
</div>
