<script lang="ts">
  import { ChevronDownIcon, RedoIcon, UndoIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import * as DropdownMenu from "@/components/ui/dropdown-menu";
  import * as Kbd from "@/components/ui/kbd";
  // import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { getShortcutLabel } from "@/components/ui/kbd/utils";
  import { cn } from "@/utils";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { IToolbarItem, IToolbarNode, IToolbarGroupNode } from "@/plugin/v2/types";
  import type { ButtonVariant } from "@/components/ui/button/button.svelte";
  import type { AnnotationHeaderBarBaseTool } from "./annotation-header-bar.types";

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

  // Track the mode before entering coverage mode, so we can restore it
  let _modeBeforeCoverage: string | null = null;
  function isCoverageMaskMode(mode: string): boolean {
    return mode.includes("coverage-mask");
  }

  function refreshToolbar() {
    if (isCoverageMaskMode(driver.mode)) {
      currentMode = _modeBeforeCoverage ?? driver.mode;
    } else {
      currentMode = driver.mode;
    }
    canUndo = driver.command.canUndo();
    canRedo = driver.command.canRedo();
  }

  driver.onModeChange((event) => {
    refreshToolbar();
    if (isCoverageMaskMode(event.newValue)) {
      if (!isCoverageMaskMode(event.oldValue)) _modeBeforeCoverage = event.oldValue;
    } else {
      driver.command.call("coverage-mask-set-mode", { mode: "off" });
    }
  });
  driver.onSyncChange(() => refreshToolbar());
  driver.command.onStackChange(() => refreshToolbar());

  onMount(refreshToolbar);

  /** Shortcut label for the dropdown-menu items (KbdTooltipButton resolves its own leaf shortcuts). */
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

  // type ButtonVariant = NonNullable<IToolbarItem["toggledVariant"]>;
  /** The collapsed button renders pressed when any child is toggled. */
  function groupActive(node: IToolbarGroupNode): boolean {
    return visibleLeaves(node).some(isItemToggled);
  }

  /** Variant for the collapsed group button — uses the active child's toggledVariant. */
  function groupActiveVariant(node: IToolbarGroupNode): ButtonVariant {
    const leaves = visibleLeaves(node);
    const active = leaves.find(isItemToggled);
    if (active) {
      const v = active.toggledVariant;
      if (v === "success" || v === "destructive") return v;
    }
    return "default";
  }

  /** Resolve the button variant for a toolbar item when toggled. */
  function resolveToggledVariant(item: IToolbarItem): ButtonVariant {
    const v = item.toggledVariant;
    if (v === "success" || v === "destructive") return v;
    return "default";
  }

  /** CSS class for a toggled dropdown-menu item, based on its toggledVariant. */
  function toggledItemClass(item: IToolbarItem): string {
    if (!isItemToggled(item)) return "";
    const v = item.toggledVariant;
    if (v === "success") return "bg-green-500 text-white focus:bg-green-500 focus:text-white data-highlighted:bg-green-500 data-highlighted:text-white";
    if (v === "destructive") return "bg-destructive text-white focus:bg-destructive focus:text-white data-highlighted:bg-destructive data-highlighted:text-white";
    return "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground data-highlighted:bg-primary data-highlighted:text-primary-foreground";
  }

  /** CSS class for the collapsed group sub-trigger, based on the active leaf's toggledVariant. */
  function groupActiveVariantClass(node: IToolbarGroupNode): string {
    const leaves = visibleLeaves(node);
    const active = leaves.find(isItemToggled);
    const v = active?.toggledVariant;
    if (v === "success") return "bg-green-500 text-white data-[state=open]:bg-green-500 data-[state=open]:text-white";
    if (v === "destructive") return "bg-destructive text-white data-[state=open]:bg-destructive data-[state=open]:text-white";
    return "bg-primary text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground";
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
  <KbdTooltipButton
    label={item.label}
    {driver}
    commandName={item.name}
    align="center"
    delayDuration={100}
    variant={isToggled ? resolveToggledVariant(item) : "ghost"}
    size="icon-sm"
    onclick={item.onClick}
    disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html item.icon}
  </KbdTooltipButton>
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
          toggledItemClass(node.item),
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
          groupActive(node) && groupActiveVariantClass(node),
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
          variant={groupActive(node) ? groupActiveVariant(node) : "ghost"}
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

  {#each commands as { name, label, icon, disabled, handleClick }, commandIndex (commandIndex)}
    <KbdTooltipButton
      {label}
      {driver}
      commandName={name}
      {icon}
      align="center"
      delayDuration={100}
      variant="ghost"
      size="icon-sm"
      {disabled}
      onclick={handleClick}
    />
  {/each}

  <Separator orientation="vertical"></Separator>
</div>
