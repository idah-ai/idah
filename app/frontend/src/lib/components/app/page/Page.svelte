<script lang="ts">
	import { onMount } from "svelte";

	import ApplicationHeader from "$/lib/components/app/application/ApplicationHeader.svelte";

	import type { WithElementRef } from "$/lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	type Props = WithElementRef<HTMLAttributes<HTMLElement>> & {
		name: string; // Name of the page
		// action: Action;
		// resource: Resource;
		// scopes: Scope[];
		// roles: Role[];
		redirectTo?: string;
	};
	let { ref, children, name, redirectTo = "/" }: Props = $props();

	// Variables
	let hasAccess: boolean = $state(false);

	// Lifecycle
	onMount(async () => {
		// const currentAccount = $authStatus.authContext;
		// if (await checkRights(action, resource, scopes, roles)) {
		// hasAccess = true;
		// } else {
		hasAccess = true;
		// }
	});
</script>

{#if hasAccess}
	<ApplicationHeader />

	<section id={name} bind:this={ref} class="flex flex-col gap-4">
		{@render children?.()}
	</section>
{/if}
