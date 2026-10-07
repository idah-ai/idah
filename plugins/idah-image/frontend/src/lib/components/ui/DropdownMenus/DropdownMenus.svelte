<script lang="ts">
  import { EllipsisVerticalIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import { Button, type ButtonSize } from "$lib/components/ui/Button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index";
  import Tooltips from "$lib/components/app/tooltips/tooltips.svelte";

  import { cn } from "$lib/utils";

  import type {
    DropdownMenuContentAlignment,
    DropdownMenuContentSide,
    IDropdownMenuItem,
    IDropdownMenus,
  } from "$lib/components/ui/DropdownMenus/types";

  // Props
  interface Props {
    class?: string | null;
    align?: DropdownMenuContentAlignment;
    side?: DropdownMenuContentSide;
    triggerSize?: ButtonSize;
    menus: IDropdownMenus;
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
  }
  let {
    class: className,
    align = "start",
    side = "bottom",
    triggerSize = "icon",
    menus,
    trigger,
  }: Props = $props();
</script>

{#snippet DropdownMenusItem(item: IDropdownMenuItem)}
  <DropdownMenu.Item
    class={cn("", {
      "cursor-not-allowed": item.disabled,
      "cursor-pointer": item.action,
    })}
    disabled={item.disabled}
    onclick={() => item.action?.()}
  >
    {#if item.icon}
      <item.icon class="size-4 shrink-0" />
    {/if}

    {item.label}
  </DropdownMenu.Item>
{/snippet}

{#snippet DropdownMenuItemTooltip(item: IDropdownMenuItem)}
  <Tooltips align="center" ignoreNonKeyboardFocus>
    {#snippet trigger()}
      {@render DropdownMenusItem(item)}
    {/snippet}

    {#snippet content()}
      {item.tooltip}
    {/snippet}
  </Tooltips>
{/snippet}

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      {#if trigger}
        {@render trigger({ props })}
      {:else}
        {@const isOpen = props["data-state"] === "open"}
        <Button
          {...props}
          variant={isOpen ? "secondary" : "ghost"}
          size={triggerSize}
          class={cn("shrink-0", {
            "opacity-100": isOpen,
          })}
        >
          <EllipsisVerticalIcon />
        </Button>
      {/if}
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content {align} {side} class={cn("", className)}>
    {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
      {@const isLastGroup = groupIndex === Object.keys(menus).length - 1}
      <DropdownMenu.Group>
        {#if group.label}
          <DropdownMenu.GroupHeading>{group.label}</DropdownMenu.GroupHeading>
        {/if}

        {#each group.items as item, itemIndex (itemIndex)}
          {@const hidden = item.hidden ?? false}

          {#if !hidden}
            {#if item.items && Object.keys(item.items).length > 0}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  {#if item.icon}
                    <item.icon class="size-4"></item.icon>
                  {/if}

                  {item.label}
                </DropdownMenu.SubTrigger>

                <DropdownMenu.SubContent>
                  {#each Object.entries(item.items) as [subGroupKey, subGroup], subGroupIndex (subGroupKey)}
                    {@const isLastSubItem =
                      subGroupIndex === Object.keys(item.items).length - 1}

                    {#each subGroup.items as subItem, subItemIndex (subItemIndex)}
                      {@render DropdownMenusItem(subItem)}
                    {/each}

                    {#if !isLastSubItem}
                      <DropdownMenu.Separator />
                    {/if}
                  {/each}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              {:else if item.tooltip}
                {@render DropdownMenuItemTooltip(item)}
              {:else}
                {@render DropdownMenusItem(item)}
              {/if}
          {/if}
        {/each}
      </DropdownMenu.Group>

      {#if !isLastGroup}
        <DropdownMenu.Separator />
      {/if}
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
