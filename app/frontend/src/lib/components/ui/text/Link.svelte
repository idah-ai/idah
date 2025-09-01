<script lang="ts">
	import { cn, type WithElementRef } from "@/utils";
	import { ExternalLinkIcon } from "@lucide/svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref,
		href,
		showIcon = false,
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLAnchorElement>> & {
		href: string | null | undefined;
		showIcon?: boolean;
	} = $props();
</script>

<a
	{href}
	class={cn("text-primary group flex items-center gap-2 hover:underline hover:underline-offset-4", className)}
	bind:this={ref}
	{...restProps}
>
	{@render children?.()}

	{#if showIcon}
		<ExternalLinkIcon class="size-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
	{/if}
</a>
