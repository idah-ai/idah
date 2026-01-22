<script lang="ts">
  import { sidebars, type SidebarType } from "$lib/app/sidebar/sidebar.data";
  import CollapsibleContent from "$lib/components/ui/collapsible/collapsible-content.svelte";
  import CollapsibleTrigger from "$lib/components/ui/collapsible/collapsible-trigger.svelte";
  import Collapsible from "$lib/components/ui/collapsible/collapsible.svelte";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
  } from "$lib/components/ui/sidebar";
  import { ChevronRightIcon } from "@lucide/svelte";

  let { pathname }: { pathname: string } = $props();

  function hasActiveChild(item: SidebarType, pathname: string): boolean {
    if (!item.children) return false;
    return item.children.some((child) => child.href === pathname || hasActiveChild(child, pathname));
  }
</script>

{#snippet renderItem(item: SidebarType)}
  {#if item.children?.length}
    <Collapsible open={hasActiveChild(item, pathname)} class="group/collapsible w-full">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild class="w-full">
          <SidebarMenuButton
            class="
              flex w-full items-center justify-between
              transition-colors duration-200
              hover:cursor-pointer
            "
          >
            {item.label}
            <ChevronRightIcon
              class="
                size-5 lg:size-4
                transition-transform duration-300 ease-out
                group-data-[state=open]/collapsible:rotate-90
              "
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent
          class="
            overflow-hidden
            data-[state=closed]:animate-collapsible-up
            data-[state=open]:animate-collapsible-down
          "
        >
          <SidebarMenuSub class="border-none pl-4">
            {#each item.children as child (child.label)}
              {@render renderItem(child)}
            {/each}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  {:else if item.href}
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.href === pathname}
        class="
          transition-colors duration-200
          hover:text-primary hover:dark:text-secondary-foreground
          data-[active=true]:text-primary
          dark:data-[active=true]:text-secondary-foreground
        "
      >
        <a href={item.href} class="block w-full">
          {item.label}
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  {:else}
    <SidebarMenuItem>
      <SidebarGroupLabel class="p-2 text-sm font-normal text-muted-foreground">
        {item.label}
      </SidebarGroupLabel>
    </SidebarMenuItem>
  {/if}
{/snippet}

<Sidebar class="h-full overflow-y-auto border-none transition-transform duration-300 ease-in-out">
  <SidebarContent class="h-full pt-2 text-muted-foreground border-r bg-background">
    {#each sidebars as sidebar}
      <SidebarGroup>
        {#if sidebar.href}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={sidebar.href === pathname}
                  class="
                    transition-colors duration-200
                    hover:text-primary data-[active=true]:text-primary
                  "
                >
                  <a href={sidebar.href} class="block w-full">
                    {sidebar.label}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        {:else}
          <SidebarGroupLabel
            class="
              text-xs font-semibold uppercase tracking-wider
              text-foreground
            "
          >
            {sidebar.label}
          </SidebarGroupLabel>
        {/if}

        {#if sidebar.children?.length}
          <SidebarGroupContent>
            <SidebarMenu>
              {#each sidebar.children as item (item.label)}
                {@render renderItem(item)}
              {/each}
            </SidebarMenu>
          </SidebarGroupContent>
        {/if}
      </SidebarGroup>
    {/each}
  </SidebarContent>
</Sidebar>
