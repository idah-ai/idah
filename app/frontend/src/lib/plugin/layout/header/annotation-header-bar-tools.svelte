<script lang="ts">
  import { ChevronDownIcon, RedoIcon, UndoIcon } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import KbdTooltipButton from "@/components/app/tooltips/KbdTooltipButton.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Separator from "@/components/ui/separator/separator.svelte";
  import * as DropdownMenu from "@/components/ui/dropdown-menu";
  import * as Kbd from "@/components/ui/kbd";
  import * as Tooltip from "@/components/ui/tooltip";

  import { getShortcutLabel } from "@/components/ui/kbd/utils";
  import { cn } from "@/utils";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";
  import type { IToolbarItem, IToolbarNode, IToolbarGroupNode } from "@/plugin/v2/types";
  import type { AnnotationHeaderBarBaseTool } from "./annotation-header-bar.types";
  import {
    toggledButtonVariant,
    resolveToolbarText,
    itemClass,
    groupActiveVariantClass,
    accentButtonClass,
    accentSubTriggerClass,
  } from "./toolbar-variants";
  import { dividerBefore } from "./toolbar-sections";

  // Props
  interface Props {
    driver: IdahDriverV2;
  }
  let { driver }: Props = $props();

  // Variables
  const disabledToolsIfWorkflowSteps = ["done", "error"];
  /** Toolbar dividers: shorter than the buttons, centred, with room on each side. */
  const dividerClass = "mx-1 data-[orientation=vertical]:h-5";
  // Initial values; kept current by the driver subscriptions below.
  let currentMode = $state(untrack(() => driver.mode));
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

  interface ItemState {
    toggled: boolean;
    icon: string;
    label: string;
  }

  /**
   * Per-item state read from the plugin: toggled flag plus the current icon and label (which
   * may be functions of plugin state). Re-evaluated on mode change and `toolbar.invalidate()`.
   */
  let itemStates = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    driver.toolbar.revision; // track revision so itemStates re-evaluates on invalidate()
    const map = new SvelteMap<IToolbarItem, ItemState>();
    for (const item of collectLeaves(toolbarNodes)) {
      map.set(item, {
        toggled: item.whenToggled?.() ?? false,
        icon: resolveToolbarText(item.icon),
        label: resolveToolbarText(item.label),
      });
    }
    return map;
  });
  let canUndo = $state(untrack(() => driver.command.canUndo()));
  let canRedo = $state(untrack(() => driver.command.canRedo()));

  function refreshToolbar() {
    currentMode = driver.mode;
    canUndo = driver.command.canUndo();
    canRedo = driver.command.canRedo();
  }

  $effect(() => {
    const d = driver;
    return untrack(() => {
      const unsubscribers = [
        d.onModeChange(() => refreshToolbar()),
        d.onSyncChange(() => refreshToolbar()),
        d.command.onStackChange(() => refreshToolbar()),
      ];
      refreshToolbar();
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
  });

  /** Shortcut label for the dropdown-menu items (KbdTooltipButton resolves its own leaf shortcuts). */
  function cmdShortcut(name: string): string | undefined {
    const s = driver.command.getShortcut(name);
    return s ? getShortcutLabel(s) : undefined;
  }

  /** The group's main key for its tooltip: the first visible tool in it that has a shortcut. */
  function groupShortcut(node: IToolbarGroupNode): string | undefined {
    for (const leaf of visibleLeaves(node)) {
      const shortcut = leaf.name ? cmdShortcut(leaf.name) : undefined;
      if (shortcut) return shortcut;
    }
    return undefined;
  }

  /** Every group node in the tree (nested ones included). */
  function collectGroups(nodes: IToolbarNode[]): IToolbarGroupNode[] {
    const out: IToolbarGroupNode[] = [];
    for (const node of nodes) {
      if (node.kind === "group") out.push(node, ...collectGroups(node.children));
    }
    return out;
  }

  /** Group accent flags (`whenAccented`), keyed by path — re-read on `toolbar.invalidate()`. */
  let groupAccents = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    driver.toolbar.revision;
    const map = new SvelteMap<string, boolean>();
    for (const group of collectGroups(toolbarNodes)) {
      map.set(group.path, group.whenAccented?.() ?? false);
    }
    return map;
  });

  /** Top-level buttons actually shown (hidden items and emptied groups dropped). */
  let topLevel = $derived.by(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    driver.toolbar.revision; // visibleWhen may change on invalidate()
    return toolbarNodes.filter((node) =>
      node.kind === "item" ? isItemVisible(node.item) : visibleLeaves(node).length > 0,
    );
  });

  /** Divider before each top-level button whose section differs from the previous one. */
  let dividers = $derived(
    dividerBefore(topLevel.map((node) => (node.kind === "item" ? node.item.section : node.section))),
  );

  function isGroupAccented(node: IToolbarGroupNode): boolean {
    return groupAccents.get(node.path) ?? false;
  }

  function isItemToggled(item: IToolbarItem): boolean {
    return itemStates.get(item)?.toggled ?? false;
  }

  function iconOf(item: IToolbarItem): string {
    return itemStates.get(item)?.icon ?? resolveToolbarText(item.icon);
  }

  function labelOf(item: IToolbarItem): string {
    return itemStates.get(item)?.label ?? resolveToolbarText(item.label);
  }

  /** Stable `#each` key: the item's name, else the item itself; a group's path. */
  function nodeKey(node: IToolbarNode): unknown {
    return node.kind === "item" ? (node.item.name ?? node.item) : node.path;
  }

  function isItemVisible(item: IToolbarItem): boolean {
    return item.visibleWhen?.() ?? true;
  }

  /** Visible leaves within a group, in order — used to pick the collapsed icon. */
  function visibleLeaves(node: IToolbarGroupNode): IToolbarItem[] {
    return collectLeaves(node.children).filter(isItemVisible);
  }

  /** Collapsed button shows the active child's icon, else the group's own icon, else the first child's. */
  function groupIcon(node: IToolbarGroupNode): string {
    const leaves = visibleLeaves(node);
    const active = leaves.find(isItemToggled);
    if (active) return iconOf(active);
    if (node.icon) return node.icon;
    return leaves[0] ? iconOf(leaves[0]) : "";
  }

  /**
   * Groups whose menu is handing focus back to the trigger. That focus would open the group's
   * tooltip and keep it open after the pointer leaves, so the trigger skips it once.
   */
  const returningFocus = new SvelteSet<string>();

  function groupLabel(node: IToolbarGroupNode): string {
    return node.label ?? node.segment;
  }

  const commands: AnnotationHeaderBarBaseTool[] = $derived([
    {
      name: "core:history.undo",
      label: "Undo",
      icon: UndoIcon,
      disabled: !canUndo || disabledToolsIfWorkflowSteps.includes(driver.workflowStep),
      handleClick: () => driver.command.undo(),
    },
    {
      name: "core:history.redo",
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
    label={labelOf(item)}
    {driver}
    commandName={item.name}
    align="center"
    delayDuration={100}
    variant={isToggled ? toggledButtonVariant(item) : "ghost"}
    size="icon-sm"
    onclick={item.onClick}
    disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html iconOf(item)}
  </KbdTooltipButton>
{/snippet}

<!-- Child inside a dropdown: a leaf becomes an item, a nested group becomes a submenu -->
{#snippet dropdownNode(node: IToolbarNode)}
  {#if node.kind === "item"}
    {#if isItemVisible(node.item)}
      {#if node.item.separatorBefore}
        <DropdownMenu.Separator />
      {/if}
      <DropdownMenu.Item
        onclick={node.item.onClick}
        disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}
        class={cn("[&_svg]:!text-inherit", itemClass(node.item, isItemToggled(node.item)))}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html iconOf(node.item)}
        {labelOf(node.item)}
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
          (() => {
            const leaves = visibleLeaves(node);
            const active = leaves.find(isItemToggled);
            if (active) return groupActiveVariantClass(active);
            return isGroupAccented(node) ? accentSubTriggerClass(node.accentVariant) : "";
          })(),
        )}
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html groupIcon(node)}
        {groupLabel(node)}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {@render groupContent(node)}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  {/if}
{/snippet}

<!-- A group's dropdown body: optional title, then its children -->
{#snippet groupContent(node: IToolbarGroupNode)}
  {#if node.label}
    <DropdownMenu.Label>{node.label}</DropdownMenu.Label>
    <DropdownMenu.Separator />
  {/if}
  {#each node.children as child (nodeKey(child))}
    {@render dropdownNode(child)}
  {/each}
{/snippet}

<!-- A group collapsed into a single button + chevron dropdown, with a tooltip -->
{#snippet groupButton(node: IToolbarGroupNode)}
  {#if visibleLeaves(node).length > 0}
    {@const _activeLeaf = visibleLeaves(node).find(isItemToggled)}
    {@const _accented = !_activeLeaf && isGroupAccented(node)}
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={100}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger disabled={disabledToolsIfWorkflowSteps.includes(driver.workflowStep)}>
            {#snippet child({ props: menuProps })}
              <Tooltip.Trigger {...menuProps}>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    onfocus={(event: FocusEvent) => {
                      if (returningFocus.delete(node.path)) return;
                      (props.onfocus as ((event: FocusEvent) => void) | undefined)?.(event);
                    }}
                    variant={_activeLeaf ? toggledButtonVariant(_activeLeaf) : "ghost"}
                    size="icon-sm"
                    class={cn("w-auto gap-0.5 px-1.5", _accented && accentButtonClass(node.accentVariant))}
                  >
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html groupIcon(node)}
                    <ChevronDownIcon class="size-3" />
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" side="bottom" onCloseAutoFocus={() => returningFocus.add(node.path)}>
            {@render groupContent(node)}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Tooltip.Content align="center" side="top">
          {@const shortcut = groupShortcut(node)}
          <div class="flex items-center gap-4">
            <span>{groupLabel(node)}</span>
            {#if shortcut}
              <Kbd.Group>
                <Kbd.Kbd>{shortcut}</Kbd.Kbd>
              </Kbd.Group>
            {/if}
          </div>
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  {/if}
{/snippet}

<div id="annotation-header-bar-tools" class="flex h-full items-center justify-center gap-1">
  {#each topLevel as node, index (nodeKey(node))}
    {#if dividers[index]}
      <Separator orientation="vertical" class={dividerClass} />
    {/if}
    {#if node.kind === "item"}
      {@render leafButton(node.item)}
    {:else}
      {@render groupButton(node)}
    {/if}
  {/each}

  <Separator orientation="vertical" class={dividerClass} />

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

  <Separator orientation="vertical" class={dividerClass} />
</div>
