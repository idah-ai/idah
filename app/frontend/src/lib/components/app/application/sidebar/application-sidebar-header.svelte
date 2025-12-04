<script lang="ts">
  import { resolve } from "$app/paths";

  import Logo from "@/components/app/brand/logo.svelte";
  import SidebarHeader from "@/components/ui/sidebar/sidebar-header.svelte";
  import SidebarMenuButton from "@/components/ui/sidebar/sidebar-menu-button.svelte";
  import SidebarMenuItem from "@/components/ui/sidebar/sidebar-menu-item.svelte";
  import SidebarMenu from "@/components/ui/sidebar/sidebar-menu.svelte";
</script>

<SidebarHeader>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton size="lg">
        {#snippet child({ props })}
          <a href={resolve("/")} {...props}>
            <Logo />
          </a>
        {/snippet}
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
