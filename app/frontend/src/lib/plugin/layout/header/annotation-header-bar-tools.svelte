<script lang="ts">
  import { ChevronDownIcon, RedoIcon, UndoIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import ToolTooltip from "@/components/app/tooltips/tool-tooltip.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import * as DropdownMenu from "@/components/ui/dropdown-menu";
  import * as Kbd from "@/components/ui/kbd";

  import { getShortcutLabel } from "@/components/ui/kbd/utils";
  import { cn } from "@/utils";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { IToolbarItem, IToolbarNode, IToolbarGroupNode } from "@/plugin/v2/types";
  import type { AnnotationHeaderBarBaseTool } from "./annotation-header-bar.types";
  import { SvelteMap } from "svelte/reactivity";

  // Props
  interface Props {
    driver: IdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  const disabledToolsIfWorkflowSteps = ["done", "error"];
  let currentMode = $state(driver.mode);
  let toolbarNodes: IToolbarNode[] = $derived.by(() => driver.toolbar.getNodesForMode(currentMode));

  /** Flatten every leaf item in the tree (used for the toggle map). */
  function collectLeaves(nodes: IToolbarNode[]): IToolbarItem[] {
    const out: IToolbarItem[] = [];
    for (const node of nodes) {
      if (node.kind === "item") out.push(node.item);
      else out.push(...collectLeaves(node.children));
    }
    return out;
  }

  let toggledMap = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    driver.toolbar.revision; // track revision so toggledMap re-evaluates on invalidate()
    const map = new SvelteMap<string, boolean>();
    for (const item of collectLeaves(toolbarNodes)) {
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
  driver.command.onStackChange(() => refreshToolbar());

  onMount(refreshToolbar);

  function cmdShortcut(name: string): string | undefined {
    const s = driver.command.getShortcut(name);
    return s ? getShortcutLabel(s) : undefined;
  }

  function isItemToggled(item: IToolbarItem): boolean {
    return toggledMap.get(item.name ?? item.label) ?? false;
  }

  function isItemVisible(item: IToolbarItem): boolean {
    return item.visibleWhen?.() ?? true;
  }

  /** Visible leaves within a group, in order — used to pick the collapsed icon. */
  function visibleLeaves(node: IToolbarGroupNode): IToolbarItem[] {
    return collectLeaves(node.children).filter(isItemVisible);
  }

  /** Collapsed button shows the active child's icon, else the first child's. */
  function groupIcon(node: IToolbarGroupNode): string {
    const leaves = visibleLeaves(node);
    return (leaves.find(isItemToggled) ?? leaves[0])?.icon ?? "";
  }

  /** The collapsed button renders pressed when any child is toggled. */
  function groupActive(node: IToolbarGroupNode): boolean {
    return visibleLeaves(node).some(isItemToggled);
  }

  const commands: AnnotationHeaderBarBaseTool[] = $derived([
    {
      name: "history.undo",
      label: "Undo",
      icon: UndoIcon,
      disabled: !canUndo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.undo(),
    },
    {
      name: "history.redo",
      label: "Redo",
      icon: RedoIcon,
      disabled: !canRedo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.redo(),
    },
  ]);
</script>

<!-- Leaf item as a header-bar button -->
{#snippet leafButton(item: IToolbarItem)}
  {@const isToggled = isItemToggled(item)}
  <ToolTooltip
    label={item.label}
    shortcut={item.name ? cmdShortcut(item.name) : undefined}
    align="center"
    delayDuration={100}
  >
    {#snippet trigger()}
      <Button
        variant={isToggled ? "default" : "ghost"}
        size="icon-sm"
        onclick={item.onClick}
        disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html item.icon}
      </Button>
    {/snippet}
  </ToolTooltip>
{/snippet}

<!-- Child inside a dropdown: a leaf becomes an item, a nested group becomes a submenu -->
{#snippet dropdownNode(node: IToolbarNode)}
  {#if node.kind === "item"}
    {#if isItemVisible(node.item)}
      <DropdownMenu.Item
        onclick={node.item.onClick}
        disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
        class={cn(
          "[&_svg]:!text-inherit",
          isItemToggled(node.item) &&
            "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground data-highlighted:bg-primary data-highlighted:text-primary-foreground",
        )}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html node.item.icon}
        {node.item.label}
        {#if node.item.name}
          {@const shortcut = cmdShortcut(node.item.name)}
          {#if shortcut}
            <DropdownMenu.Shortcut>
              <Kbd.Kbd>
                {shortcut}
              </Kbd.Kbd>
            </DropdownMenu.Shortcut>
          {/if}
        {/if}
      </DropdownMenu.Item>
    {/if}
  {:else}
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        class={cn(
          "[&_svg]:!text-inherit",
          groupActive(node) &&
            "bg-primary text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground",
        )}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html groupIcon(node)}
        {node.segment}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {#each node.children as child (child.kind === "item" ? (child.item.name ?? child.item.label) : child.path)}
          {@render dropdownNode(child)}
        {/each}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  {/if}
{/snippet}

<!-- A group collapsed into a single button + chevron dropdown -->
{#snippet groupButton(node: IToolbarGroupNode)}
  {#if visibleLeaves(node).length > 0}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          variant={groupActive(node) ? "default" : "ghost"}
          size="icon-sm"
          class="w-auto gap-0.5 px-1.5"
          disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html groupIcon(node)}
          <ChevronDownIcon class="size-3" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" side="bottom">
        {#each node.children as child (child.kind === "item" ? (child.item.name ?? child.item.label) : child.path)}
          {@render dropdownNode(child)}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each toolbarNodes as node (node.kind === "item" ? (node.item.name ?? node.item.label) : node.path)}
    {#if node.kind === "item"}
      {#if isItemVisible(node.item)}
        {@render leafButton(node.item)}
      {/if}
    {:else}
      {@render groupButton(node)}
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
