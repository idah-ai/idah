<script lang="ts">
  import { sidebars, type SidebarProps } from "$lib/app/sidebar/sidebar.data";
  import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
  } from "$lib/components/ui/sidebar";
  import SidebarMenuSub from "$lib/components/ui/sidebar/sidebar-menu-sub.svelte";

  let { pathname }: { pathname: string } = $props();
</script>

{#snippet renderItem(item: SidebarProps)}
  <SidebarMenuItem>
    {#if item.href}
      <SidebarMenuButton class="hover:text-primary data-[active=true]:text-primary" isActive={item.href === pathname}
        ><a href={item.href}>{item.label}</a></SidebarMenuButton
      >
    {:else}
      <SidebarGroupLabel class="text-sm text-muted-foreground font-normal">
        {item.label}
      </SidebarGroupLabel>
    {/if}
    {#if item.children?.length}
      <SidebarMenuSub class="border-none">
        {#each item.children as child (child.label)}
          {@render renderItem(child)}
        {/each}
      </SidebarMenuSub>
    {/if}
  </SidebarMenuItem>
{/snippet}

<Sidebar class="min-h-screen pt-16 overflow-y-auto border-none">
  <SidebarContent class="h-full pt-2 text-muted-foreground border-r">
    {#each sidebars as sidebar}
      <SidebarGroup>
        {#if sidebar.href}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  class="hover:text-primary data-[active=true]:text-primary"
                  isActive={sidebar.href === pathname}
                >
                  <a href={sidebar.href}>{sidebar.label}</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        {:else}
          <SidebarGroupLabel class="text-xs font-semibold uppercase tracking-wider text-foreground">
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
