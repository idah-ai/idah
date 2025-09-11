<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { WithElementRef } from "@/utils";

	import AccountDropdown from "@/components/app/iam/accounts/dropdowns/account-dropdown.svelte";

	import SidebarFooter from "@/components/ui/sidebar/sidebar-footer.svelte";
	import SidebarMenu from "@/components/ui/sidebar/sidebar-menu.svelte";
	import SidebarMenuItem from "@/components/ui/sidebar/sidebar-menu-item.svelte";

	let { children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<SidebarFooter>
	{@render children?.()}
	<SidebarMenu>
		<SidebarMenuItem>
			<AccountDropdown />
		</SidebarMenuItem>
	</SidebarMenu>
</SidebarFooter>
