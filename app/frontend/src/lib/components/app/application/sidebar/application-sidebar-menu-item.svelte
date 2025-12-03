<script lang="ts" module>
  import { type Icon as IconType } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  import type { Role } from "@/data/model/iam/accounts/auth/constants";

  export interface ApplicationSidebarMenuItemProps {
    label: string;
    href?: string;
    icon?: typeof IconType;
    visibleIfRoles: Array<Role>;
    onClick?: () => void;
  }
</script>

<script lang="ts">
  import { page } from "$app/state";

  import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

  import { cn } from "@/utils";
  import { authStatus } from "@/security/AuthContext";

  // Props
  interface Props extends ApplicationSidebarMenuItemProps {
    class?: string | null;
    children?: Snippet;
  }
  let {
    label,
    href = "#",
    icon: Icon,
    visibleIfRoles,
    onClick = () => {},
    class: className,
    children,
  }: Props = $props();
</script>

{#if $authStatus.authContext}
  {#if visibleIfRoles.includes($authStatus.authContext?.roleName)}
    <SidebarMenu>
      <SidebarMenuItem class={cn("", className)}>
        <SidebarMenuButton
          isActive={page.url.pathname.startsWith(href || "#")}
          onclick={() => {
            onClick?.();
          }}
        >
          {#snippet child({ props })}
            {#if children}
              {@render children?.()}
            {:else}
              <a {href} {...props}>
                {#if Icon}
                  <Icon />
                {/if}

                {label}
              </a>
            {/if}
          {/snippet}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  {/if}
{/if}
