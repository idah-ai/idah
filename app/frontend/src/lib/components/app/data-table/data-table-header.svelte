<script lang="ts">
	import { cn, type WithElementRef } from "@/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div id="data-table-header" class={cn("flex w-full items-center justify-between gap-4", className)}>
	{@render children?.()}
</div>
