<script lang="ts">
  import { CircleUserRoundIcon, LogOutIcon, SettingsIcon, SunMoonIcon } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import DropdownMenus from "@/components/app/dropdown-menus/dropdown-menus.svelte";
  import AvatarFallback from "@/components/ui/avatar/avatar-fallback.svelte";
  import AvatarImage from "@/components/ui/avatar/avatar-image.svelte";
  import Avatar from "@/components/ui/avatar/avatar.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";

  import { useSidebar } from "@/components/ui/sidebar";
  import { accountAuthService } from "@/data/model/iam/accounts/auth/records";
  import { AuthContext, authStatus } from "@/security/AuthContext";
  import { getAvatarFallback, humanize } from "@/utils/string";

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
      <Avatar class="size-8 rounded-lg">
        <AvatarImage src={pictureUrl} alt="" />
        <AvatarFallback class="rounded-lg">
          {getAvatarFallback(name || email || "")}
        </AvatarFallback>
      </Avatar>

      <div class="grid flex-1 text-left text-sm leading-tight">
        <span class="truncate font-medium">{name || email}</span>
        <span class="truncate text-xs">{email}</span>

        <Badge variant="outline" class="mt-1">{humanize(roleName)}</Badge>
      </div>
    </SidebarMenuButton>
  {/snippet}
</DropdownMenus>
