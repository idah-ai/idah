<script lang="ts">
	import { Label } from "$lib/components/ui/label";

	import { cn } from "$lib/utils";

	import type { Snippet } from "svelte";

	interface Props {
		required: boolean;
		class?: string | null;
		children?: Snippet;
	}
	let { required = false, class: className, children, ...restProps }: Props = $props();
</script>

<Label
	class={cn(
		"font-medium leading-none",
		{
			"text-muted-foreground": !required,
		},
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</Label>
