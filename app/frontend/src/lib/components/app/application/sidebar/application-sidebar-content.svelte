<script lang="ts">
  import { BuildingIcon, RocketIcon, UsersRoundIcon } from "@lucide/svelte";

  import ApplicationSidebarMenuItem from "@/components/app/application/sidebar/application-sidebar-menu-item.svelte";
  import { SidebarContent, SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";

  import type { ApplicationSidebarMenuItemProps } from "@/components/app/application/sidebar/application-sidebar-menu-item.svelte";

  // Variables
  let primaryMenus: ApplicationSidebarMenuItemProps[] = $state([
    {
      label: "Projects",
      href: "/projects",
      visibleIfRoles: ["admin", "org_owner", "user"],
      icon: RocketIcon,
    },
    {
      label: "Accounts",
      href: "/accounts",
      visibleIfRoles: ["admin", "org_owner"],
      icon: UsersRoundIcon,
    },
    {
      label: "Organizations",
      href: "/organizations",
      visibleIfRoles: ["admin", "org_owner"],
      icon: BuildingIcon,
    },
  ]);
</script>

<SidebarContent>
  <SidebarGroup>
    <SidebarGroupContent>
      {#each primaryMenus as item, index (index)}
        <ApplicationSidebarMenuItem {...item}></ApplicationSidebarMenuItem>
      {/each}
    </SidebarGroupContent>
  </SidebarGroup>
</SidebarContent>
