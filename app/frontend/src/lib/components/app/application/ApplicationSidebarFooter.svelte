<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { WithElementRef } from "$/lib/utils";

	import AccountDropdown from "$/lib/components/app/iam/accounts/dropdowns/AccountDropdown.svelte";

	import SidebarFooter from "$lib/components/ui/sidebar/sidebar-footer.svelte";
	import SidebarMenu from "$lib/components/ui/sidebar/sidebar-menu.svelte";
	import SidebarMenuItem from "$lib/components/ui/sidebar/sidebar-menu-item.svelte";

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
