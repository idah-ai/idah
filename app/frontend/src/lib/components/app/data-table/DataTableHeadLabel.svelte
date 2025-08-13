<script lang="ts">
	import Text from "$/lib/components/ui/text/Text.svelte";

	import { cn, type WithElementRef } from "$/lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let { class: className, children }: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<Text class={cn("text-primary inline-flex items-center gap-2", className)} size="sm">
	{@render children?.()}
</Text>
