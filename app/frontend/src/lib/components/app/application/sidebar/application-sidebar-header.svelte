<script lang="ts">
  import { resolve } from "$app/paths";

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
            <div class="grid flex-1 text-left text-2xl leading-tight">
              <span class="truncate font-semibold">IDAH</span>
            </div>
          </a>
        {/snippet}
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
