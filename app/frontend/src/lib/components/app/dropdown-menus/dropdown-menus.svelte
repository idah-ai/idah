<script lang="ts">
  import { EllipsisVerticalIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import { Button, type ButtonSize } from "@/components/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupHeading,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  import { cn } from "@/utils";
  import { authStatus } from "@/security/AuthContext";

  import type {
    DropdownMenuContentAlignment,
    DropdownMenuContentSide,
    IDropdownMenuItem,
    IDropdownMenus,
  } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    class?: string | null;
    align?: DropdownMenuContentAlignment;
    side?: DropdownMenuContentSide;
    triggerSize?: ButtonSize;
    menus: IDropdownMenus;
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
  }
  let { class: className, align = "start", side = "bottom", triggerSize = "icon", menus, trigger }: Props = $props();

  const currentRole = $derived($authStatus.authContext?.roleName);

  function isItemVisible(item: IDropdownMenuItem): boolean {
    if (item.hidden) return false;
    if (item.visibleIfRoles) return currentRole ? item.visibleIfRoles.includes(currentRole) : false;
    return true;
  }
</script>

{#snippet DropdownMenusItem(item: IDropdownMenuItem)}
  <DropdownMenuItem
    variant={item.destructive ? "destructive" : "default"}
    class={cn("", {
      "cursor-not-allowed": item.disabled,
      "cursor-pointer": item.action,
    })}
    disabled={item.disabled}
    onclick={() => item.action?.()}
  >
    {#if item.icon}
      <item.icon class="size-4" />
    {/if}

    {item.label}
  </DropdownMenuItem>
{/snippet}

<DropdownMenu>
  <DropdownMenuTrigger>
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
  </DropdownMenuTrigger>

  <DropdownMenuContent {align} {side} class={cn("", className)}>
    {#each Object.entries(menus) as [groupKey, group], groupIndex (groupKey)}
      {@const isLastGroup = groupIndex === Object.keys(menus).length - 1}
      <DropdownMenuGroup>
        {#if group.label}
          <DropdownMenuGroupHeading>{group.label}</DropdownMenuGroupHeading>
        {/if}

        {#each group.items as item, itemIndex (itemIndex)}
          {#if isItemVisible(item)}
            {#if item.items && Object.keys(item.items).length > 0}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {#if item.icon}
                    <item.icon class="size-4"></item.icon>
                  {/if}

                  {item.label}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent>
                  {#each Object.entries(item.items) as [subGroupKey, subGroup], subGroupIndex (subGroupKey)}
                    {@const isLastSubItem = subGroupIndex === Object.keys(item.items).length - 1}

                    {#if subGroup.label}
                      <DropdownMenuLabel class="text-muted-foreground text-xs">{subGroup.label}</DropdownMenuLabel>
                    {/if}

                    {#each subGroup.items as subItem, subItemIndex (subItemIndex)}
                      {@render DropdownMenusItem(subItem)}
                    {/each}

                    {#if !isLastSubItem}
                      <DropdownMenuSeparator />
                    {/if}
                  {/each}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            {:else}
              {@render DropdownMenusItem(item)}
            {/if}
          {/if}
        {/each}
      </DropdownMenuGroup>

      {#if !isLastGroup}
        <DropdownMenuSeparator />
      {/if}
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
