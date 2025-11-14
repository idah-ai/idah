<script lang="ts">
  import { ChevronsUpDownIcon, CircleUserRoundIcon, LogOutIcon, SettingsIcon, SunMoonIcon } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AvatarFallback from "@/components/ui/avatar/avatar-fallback.svelte";
  import AvatarImage from "@/components/ui/avatar/avatar-image.svelte";
  import Avatar from "@/components/ui/avatar/avatar.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";

  import { useSidebar } from "@/components/ui/sidebar";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext, authStatus } from "@/security/AuthContext";
  import { getAvatarFallback } from "@/utils/string";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Variables
  AuthContext.backend ||= accountAuthService();

  let currentAccount = $derived($authStatus.authContext);

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
            // Handle settings action
          },
        },
      ],
    },
    auth: {
      items: [
        {
          label: "Log out",
          icon: LogOutIcon,
          action: async () => {
            await AuthContext.logout();
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
        <AvatarImage src={currentAccount?.pictureUrl} alt="" />
        <AvatarFallback class="rounded-lg">
          {getAvatarFallback(currentAccount?.name || currentAccount?.email || "")}
        </AvatarFallback>
      </Avatar>

      <div class="grid flex-1 text-left text-sm leading-tight">
        <span class="truncate font-medium">{currentAccount?.name || currentAccount?.email}</span>
        <span class="truncate text-xs">{currentAccount?.email}</span>
      </div>

      <ChevronsUpDownIcon class="ml-auto size-4" />
    </SidebarMenuButton>
  {/snippet}
</DropdownMenus>
