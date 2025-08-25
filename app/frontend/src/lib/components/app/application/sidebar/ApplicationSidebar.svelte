<script lang="ts">
	import type { ComponentProps } from "svelte";

	import ApplicationSidebarContent from "@/components/app/application/sidebar/ApplicationSidebarContent.svelte";
	import ApplicationSidebarHeader from "@/components/app/application/sidebar/ApplicationSidebarHeader.svelte";
	import ApplicationSidebarFooter from "@/components/app/application/sidebar/ApplicationSidebarFooter.svelte";
	import Sidebar from "@/components/ui/sidebar/sidebar.svelte";
	import SidebarRail from "@/components/ui/sidebar/sidebar-rail.svelte";

	// Props
	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar> = $props();
</script>

<Sidebar bind:ref variant="inset" {...restProps}>
	<ApplicationSidebarHeader />
	<ApplicationSidebarContent />
	<ApplicationSidebarFooter />

	<SidebarRail />
</Sidebar>
