<script lang="ts">
  import type { SidebarType } from "$lib/app/sidebar/sidebar.data";
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import { cn } from "$lib/utils";
  import { ChevronRightIcon } from "@lucide/svelte";
  import { hasActiveChild } from "$lib/app/sidebar/sidebar.utils";
  import SidebarItem from "./sidebar-item.svelte";

  let {
    item,
    pathname,
    class: className = "",
  }: {
    item: SidebarType;
    pathname: string;
    class?: string;
  } = $props();

  const hasChildren = $derived(item.children?.length > 0);
  const isActive = $derived(item.href === pathname);
  const hasActiveDescendant = $derived(hasActiveChild(item, pathname));
</script>

{#if hasChildren}
  <Collapsible
    class={cn("group/collapsible w-full", className)}
    open={hasActiveDescendant}
  >
    <CollapsibleTrigger
      class="
        flex w-full items-center justify-between rounded-md
        px-2 py-1.5 text-left
        transition-colors duration-200
        hover:cursor-pointer hover:bg-muted
      "
    >
      <span>{item.label}</span>
      <ChevronRightIcon
        class="
          size-5 lg:size-4
          transition-transform duration-300 ease-out
          group-data-[state=open]/collapsible:rotate-90
        "
      />
    </CollapsibleTrigger>

    <CollapsibleContent class="ml-4 mt-1">
      <div class="flex flex-col gap-1">
        {#each item.children as child (child.label)}
          <SidebarItem item={child} {pathname} />
        {/each}
      </div>
    </CollapsibleContent>
  </Collapsible>
{:else if item.href}
  <a
    href={item.href}
    class={cn(
      "block w-full px-2 py-1.5 rounded-md transition-colors",
      "hover:bg-muted hover:text-primary cursor-pointer",
      {
        "text-primary bg-muted font-semibold": isActive,
      },
      className,
    )}
  >
    {item.label}
  </a>
{:else}
  <div class={cn("px-2 py-1.5 text-muted-foreground", className)}>
    {item.label}
  </div>
{/if}
