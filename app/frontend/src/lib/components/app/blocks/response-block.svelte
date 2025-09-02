<script lang="ts">
	import Button from "@/components/ui/button/button.svelte";
	import Text from "@/components/ui/text/Text.svelte";

	import { type Icon as IconType } from "@lucide/svelte";

	import type { Snippet } from "svelte";

	// Props
	interface Props {
		icon?: typeof IconType;

		title?: string;
		slotTitle?: Snippet;

		description?: string;
		slotDescription?: Snippet;

		actions?: Snippet;
	}
	let { icon: Icon, title, slotTitle, description, slotDescription, actions }: Props = $props();
</script>

<div id="response-block-container" class="flex flex-col items-center gap-4">
	<!-- RESPONSE BLOCK::ICON -->
	<Button variant="outline" size="icon">
		{#if Icon}
			<Icon class="size-4" />
		{/if}
	</Button>

	<!-- RESPONSE BLOCK::CONTENT -->
	<div class="flex flex-col items-center gap-1">
		{#if slotTitle}
			{@render slotTitle?.()}
		{:else}
			<Text weight="semibold" class="capitalize">{title}</Text>
		{/if}

		{#if slotDescription}
			{@render slotDescription?.()}
		{:else}
			<Text size="sm" class="text-muted-foreground">{description}</Text>
		{/if}
	</div>

	<!-- RESPONSE BLOCK::ACTIONS -->
	{#if actions}
		{@render actions?.()}
	{:else}
		<Button class="capitalize">Action</Button>
	{/if}
</div>
