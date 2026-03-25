<script lang="ts">
  import {
    desktopSidebarItems,
    type SidebarType,
  } from "$lib/app/sidebar/sidebar.data";
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
  import { SidebarProvider } from "$lib/components/ui/sidebar";
  import SidebarItem from "./sidebar-item.svelte";
  import { mergeSidebarItemsWithApiUrls } from "$lib/app/sidebar/sidebar.utils";

  let {
    pathname,
    apiUrls,
  }: { pathname: string; apiUrls: { url: string; name: string }[] } = $props();

  const mergedSidebarItems = $derived<SidebarType[]>(
    mergeSidebarItemsWithApiUrls(desktopSidebarItems, apiUrls),
  );
</script>

<SidebarProvider>
  <Sidebar class="pt-0 md:pt-16 overflow-y-auto border-none">
    <SidebarContent
      class="h-full pt-2 text-muted-foreground border-r bg-background"
    >
      {#each mergedSidebarItems as sidebar (sidebar.label)}
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
                  <SidebarItem {item} {pathname} />
                {/each}
              </SidebarMenu>
            </SidebarGroupContent>
          {/if}
        </SidebarGroup>
      {/each}
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
