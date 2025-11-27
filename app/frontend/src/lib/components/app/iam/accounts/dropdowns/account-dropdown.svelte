<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { ChevronsUpDownIcon, CircleUserRoundIcon, LogOutIcon, SettingsIcon, SunMoonIcon } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AvatarFallback from "@/components/ui/avatar/avatar-fallback.svelte";
  import AvatarImage from "@/components/ui/avatar/avatar-image.svelte";
  import Avatar from "@/components/ui/avatar/avatar.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";

  import { useSidebar } from "@/components/ui/sidebar";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Variables
  const sidebar = useSidebar();
  const menus: IDropdownMenus = {
    general: {
      items: [
        {
          label: "Profile",
          icon: CircleUserRoundIcon,
          action: () => {
            // Handle profile action
          },
        },
        {
          label: "Theme",
          icon: SunMoonIcon,
          action: toggleMode,
        },
        {
          label: "Settings",
          icon: SettingsIcon,
          action: () => {
            goto(resolve("/settings/notifications"));
          },
        },
      ],
    },
    auth: {
      items: [
        {
          label: "Log out",
          icon: LogOutIcon,
          action: () => {
            // Handle log out action
          },
        },
      ],
    },
  };
</script>

<DropdownMenus {menus} align="end" side={sidebar.isMobile ? "bottom" : "right"} class="min-w-56">
  {#snippet trigger({ props })}
    <SidebarMenuButton
      {...props}
      size="lg"
      class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <Avatar class="size-8 rounded-lg">
        <AvatarImage src="" alt=""></AvatarImage>
        <AvatarFallback class="rounded-lg">EU</AvatarFallback>
      </Avatar>

      <div class="grid flex-1 text-left text-sm leading-tight">
        <span class="truncate font-medium">Example User</span>
        <span class="truncate text-xs">example@ingedata.ai</span>
      </div>
      <ChevronsUpDownIcon class="ml-auto size-4"></ChevronsUpDownIcon>
    </SidebarMenuButton>
  {/snippet}
</DropdownMenus>
