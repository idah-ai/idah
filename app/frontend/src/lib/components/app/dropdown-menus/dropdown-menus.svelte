<script lang="ts">
  import type { Snippet } from "svelte";

  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupHeading,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";

  import { cn } from "@/utils";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Props
  interface Props {
    class?: string | null;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    menus: IDropdownMenus;
    trigger: Snippet<[{ props: Record<string, unknown> }]>;
  }
  let { class: className, align = "start", side = "bottom", menus, trigger }: Props = $props();
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      {@render trigger({ props })}
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
          {@const hidden = item.hidden ?? false}

          {#if !hidden}
            <DropdownMenuItem
              class={cn("", {
                "cursor-not-allowed": item.disabled,
                "cursor-pointer": item.action,
              })}
              disabled={item.disabled}
              onclick={() => item.action?.()}
            >
              {#if item.icon}
                <item.icon class="size-4"></item.icon>
              {/if}

              {item.label}
            </DropdownMenuItem>
          {/if}
        {/each}
      </DropdownMenuGroup>

      {#if !isLastGroup}
        <DropdownMenuSeparator></DropdownMenuSeparator>
      {/if}
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
