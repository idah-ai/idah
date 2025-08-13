<script lang="ts">
	import { cn, type WithElementRef } from "$/lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div id="data-table-toolbar-actions" class={cn("flex items-center justify-end gap-4", className)}>
	{@render children?.()}
</div>
