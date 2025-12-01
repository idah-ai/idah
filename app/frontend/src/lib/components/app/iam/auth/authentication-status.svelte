<script lang="ts">
	import { cn } from "@/utils";
	import { onMount, type Snippet } from "svelte";

	interface Props {
		class?: string | null;
		loading?: Snippet;
		authorized?: Snippet;
		unauthorized?: Snippet;
	}
	let { class: className, loading, authorized, unauthorized }: Props = $props();

	// internal state
	let authStatus: "loading" | "authorized" | "unauthorized" = $state("loading");

	onMount(async () => {
		await checkAuthStatus();
	});

	async function checkAuthStatus(): Promise<void> {
		try {
			// your real API call
			authStatus = "unauthorized";
		} catch (err) {
			authStatus = "unauthorized";
		}
	}
</script>

<div class={cn("", className)}>
	{#if authStatus === "loading"}
		{@render loading?.()}
	{:else if authStatus === "authorized"}
		{@render authorized?.()}
	{:else if authStatus === "unauthorized"}
		{@render unauthorized?.()}
	{/if}
</div>
