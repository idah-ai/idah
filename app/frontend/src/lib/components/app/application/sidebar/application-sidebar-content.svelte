<script lang="ts">
  import ApplicationSidebarMenuItem from "@/components/app/application/sidebar/application-sidebar-menu-item.svelte";
  import { SidebarContent, SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
  import { BellIcon, LifeBuoyIcon, RocketIcon, UsersRoundIcon } from "@lucide/svelte";

  import type { ApplicationSidebarMenuItemProps } from "@/components/app/application/sidebar/application-sidebar-menu-item.svelte";

  // Variables
  let primaryMenus: ApplicationSidebarMenuItemProps[] = $state([
    {
      label: "Projects",
      href: "/projects",
      icon: RocketIcon,
    },
    {
      label: "Accounts",
      href: "/accounts",
      icon: UsersRoundIcon,
    },
  ]);

  let secondaryMenus: ApplicationSidebarMenuItemProps[] = $state([
    {
      label: "Notifications",
      href: "/notifications",
      icon: BellIcon,
    },
    {
      label: "Support",
      href: "/supports",
      icon: LifeBuoyIcon,
    },
  ]);
</script>

<SidebarContent>
  <SidebarGroup>
    <SidebarGroupContent>
      {#each primaryMenus as item}
        <ApplicationSidebarMenuItem {...item} />
      {/each}
    </SidebarGroupContent>
  </SidebarGroup>

  <SidebarGroup class="mt-auto">
    <SidebarGroupContent>
      {#each secondaryMenus as item}
        <ApplicationSidebarMenuItem {...item} />
      {/each}
    </SidebarGroupContent>
  </SidebarGroup>
</SidebarContent>
