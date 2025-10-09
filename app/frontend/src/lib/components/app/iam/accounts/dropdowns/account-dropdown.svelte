<script lang="ts">
  import { ChevronsUpDownIcon, CircleUserRoundIcon, LogOutIcon, SettingsIcon, SunMoonIcon } from "@lucide/svelte";
  import { toggleMode } from "mode-watcher";

  import AvatarFallback from "@/components/ui/avatar/avatar-fallback.svelte";
  import AvatarImage from "@/components/ui/avatar/avatar-image.svelte";
  import Avatar from "@/components/ui/avatar/avatar.svelte";
  import { DropdownMenu } from "@/components/ui/dropdown-menu";
  import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuGroup from "@/components/ui/dropdown-menu/dropdown-menu-group.svelte";
  import DropdownMenuItem from "@/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import DropdownMenuLabel from "@/components/ui/dropdown-menu/dropdown-menu-label.svelte";
  import DropdownMenuSeparator from "@/components/ui/dropdown-menu/dropdown-menu-separator.svelte";
  import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";

  import { useSidebar } from "@/components/ui/sidebar";

  // Variables
  const sidebar = useSidebar();
  const dropdownMenus = [
    {
      group: "general",
      showGroupLabel: false,
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
    {
      group: "authentication",
      showGroupLabel: false,
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
  ];
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
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
  </DropdownMenuTrigger>

  <DropdownMenuContent
    class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
    side={sidebar.isMobile ? "bottom" : "right"}
    align="end"
    sideOffset={4}
  >
    {#each dropdownMenus as { group, showGroupLabel, items }, index (index)}
      {@const isLastgroup = index === dropdownMenus.length - 1}
      <DropdownMenuGroup>
        {#if showGroupLabel}
          <DropdownMenuLabel>{group}</DropdownMenuLabel>
        {/if}

        {#each items as { label, icon: Icon, action }, index (index)}
          <DropdownMenuItem onclick={action}>
            <Icon></Icon>
            {label}
          </DropdownMenuItem>
        {/each}
      </DropdownMenuGroup>

      {#if !isLastgroup}
        <DropdownMenuSeparator></DropdownMenuSeparator>
      {/if}
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
