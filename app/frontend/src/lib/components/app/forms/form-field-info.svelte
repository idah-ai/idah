<script lang="ts">
	import Text from "$lib/components/ui/text/Text.svelte";

	import type { Snippet } from "svelte";

	// Props
	interface Props {
		children?: Snippet;
	}
	let { children }: Props = $props();
</script>

<Text size="xs" class="text-muted-foreground">
	{@render children?.()}
</Text>
