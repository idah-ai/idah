<script lang="ts">
	import { cn, type WithElementRef } from "@/utils";
	import type { HTMLAttributes } from "svelte/elements";

	// Props
	let { class: className, children }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class={cn("flex min-h-12 items-center gap-4 px-4 py-2", className)}>
	{@render children?.()}
</div>
