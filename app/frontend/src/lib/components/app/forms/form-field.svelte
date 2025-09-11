<script lang="ts">
	import { cn } from "$lib/utils";

	import type { WithElementRef } from "bits-ui";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} class={cn("gap-sm flex flex-col gap-1", className)} {...restProps}>
	{@render children?.()}
</div>
