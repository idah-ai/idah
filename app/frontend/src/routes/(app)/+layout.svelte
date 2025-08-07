<script lang="ts">
	import ApplicationContent from "$/lib/components/app/application/ApplicationContent.svelte";
	import ApplicationSidebar from "$/lib/components/app/application/ApplicationSidebar.svelte";
	import AuthenticationStatus from "$/lib/components/app/iam/auth/AuthenticationStatus.svelte";
	import SidebarProvider from "$/lib/components/ui/sidebar/sidebar-provider.svelte";

	import type { WithElementRef } from "bits-ui";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let { children }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<AuthenticationStatus>
	{#snippet authorized()}
		<SidebarProvider>
			<ApplicationSidebar />

			<!-- MAIN APPLICATION -->
			<ApplicationContent>
				{@render children?.()}
			</ApplicationContent>
		</SidebarProvider>
	{/snippet}
</AuthenticationStatus>
