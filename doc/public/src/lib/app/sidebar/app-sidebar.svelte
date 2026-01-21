<script lang="ts">
  import { sidebars } from "$lib/app/sidebar/sidebar.data";
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
</script>

<Sidebar>
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Application</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {#each sidebars as sidebar}
            <SidebarMenuItem key={sidebar.label}>
              <SidebarMenuButton>
                <a href={sidebar.href}>{sidebar.label}</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          {/each}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>
