<script lang="ts">
  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";

  import AccountDropdown from "@/components/app/iam/accounts/dropdowns/account-dropdown.svelte";
  import SidebarFooter from "@/components/ui/sidebar/sidebar-footer.svelte";
  import SidebarMenuItem from "@/components/ui/sidebar/sidebar-menu-item.svelte";
  import SidebarMenu from "@/components/ui/sidebar/sidebar-menu.svelte";

  // Props
  let { children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<SidebarFooter>
  {@render children?.()}
  <SidebarMenu>
    <SidebarMenuItem>
      <AccountDropdown></AccountDropdown>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
