<script lang="ts">
  import { CircleUserRoundIcon, LogOutIcon, SettingsIcon, SunMoonIcon } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AccountAvatar from "@/components/app/iam/accounts/avatars/account-avatar.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";

  import { useSidebar } from "@/components/ui/sidebar";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext, authStatus } from "@/security/AuthContext";

  import type { IDropdownMenus } from "@/components/app/dropdown-menus/types";

  // Variables
  AuthContext.backend ||= accountAuthService();

  let loggedInAccount = $derived($authStatus.authContext);
  let { name, email, pictureUrl, roleName } = $derived(
    loggedInAccount || {
      name: "",
      email: "",
      pictureUrl: "",
      roleName: "user",
    },
  );

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
      class="data-[state=open]:bg-background data-[state=open]:text-foreground hover:bg-background hover:text-foreground h-auto items-start"
    >
      <AccountAvatar align="start" {name} {email} {pictureUrl} {roleName} showName showEmail showRole />
    </SidebarMenuButton>
  {/snippet}
</DropdownMenus>
