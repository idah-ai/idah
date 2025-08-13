<script lang="ts">
	import Text from "$lib/components/ui/text/Text.svelte";

	// Props
	interface Props {
		errors?: string[];
	}
	let { errors }: Props = $props();
</script>

{#if errors}
	<div class="flex flex-col gap-0">
		{#each errors as error}
			<Text class="text-destructive leading-tight" size="xs">{error}</Text>
		{/each}
	</div>
{/if}
