<script lang="ts">
	import type { ComponentProps } from "svelte";

	import ApplicationSidebarContent from "$lib/components/app/application/ApplicationSidebarContent.svelte";
	import ApplicationSidebarHeader from "$lib/components/app/application/ApplicationSidebarHeader.svelte";
	import ApplicationSidebarFooter from "$lib/components/app/application/ApplicationSidebarFooter.svelte";
	import Sidebar from "$lib/components/ui/sidebar/sidebar.svelte";
	import SidebarRail from "$lib/components/ui/sidebar/sidebar-rail.svelte";

	// Props
	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar> = $props();
</script>

<Sidebar bind:ref variant="inset" {...restProps}>
	<ApplicationSidebarHeader />
	<ApplicationSidebarContent />
	<ApplicationSidebarFooter />

	<SidebarRail />
</Sidebar>
