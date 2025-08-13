<script lang="ts">
	import { cn, type WithElementRef } from "$/lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>>;
	let { ref, class: className, children }: Props = $props();
</script>

<div bind:this={ref} class={cn("grid gap-4 px-1", className)}>
	{@render children?.()}
</div>
