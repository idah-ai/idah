<script lang="ts">
	import { cn } from "@/utils";

	// Props
	interface StackedValue {
		label: string;
		value: number;
		bgColor: string;
		textColor?: string;
	}

	interface Props {
		values: StackedValue[];
	}
	let { values }: Props = $props();

	// Variables
	let total: number = $derived(values.reduce((acc, { value }) => acc + value, 0));
</script>

<div class="flex w-full flex-col gap-4">
	<!-- STACKED BAR -->
	<div class="flex h-4 w-full rounded-sm">
		{#each values as { value, bgColor, textColor = "text-primary-foreground" }, index (index)}
			{@const percentage = value / total}
			{@const width = parseFloat(String(percentage * 100)).toFixed(2)}
			<div
				class={cn(
					"inline-flex h-6 items-center justify-center px-2 py-1 first:rounded-bl-sm first:rounded-tl-sm last:rounded-br-sm last:rounded-tr-sm",
					bgColor,
				)}
				style:width="{width}%"
			>
				<span class={cn(textColor, "text-xs font-medium")}>{width} %</span>
			</div>
		{/each}
	</div>

	<!-- LEGEND -->
	<div class="flex flex-1 items-center justify-center gap-6">
		{#each values as { label, bgColor }, index (index)}
			<div class="inline-flex items-center gap-2">
				<div class={cn("size-3 rounded-full", bgColor, {})}></div>
				<span class="text-muted-foreground text-sm">{label}</span>
			</div>
		{/each}
	</div>
</div>
