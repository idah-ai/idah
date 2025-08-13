<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$/lib/utils";
	import { tv, type VariantProps } from "tailwind-variants";

	export const textVariants = tv({
		base: "",
		variants: {
			size: {
				default: "text-base",
				h1: "text-3xl font-semibold",
				h2: "text-2xl font-semibold",
				h3: "text-xl font-semibold",
				h4: "text-lg font-semibold",
				sm: "text-sm",
				xs: "text-xs",
			},
			weight: {
				extralight: "font-extralight",
				light: "font-light",
				normal: "font-normal",
				medium: "font-medium",
				semibold: "font-semibold",
				bold: "font-bold",
				extrabold: "font-extrabold",
			},
		},
		defaultVariants: {
			size: "default",
			weight: "normal",
		},
	});

	export type TextSize = VariantProps<typeof textVariants>["size"];
	export type TextWeight = VariantProps<typeof textVariants>["weight"];

	export type TextProps = WithElementRef<HTMLAttributes<HTMLElement>> & {
		size?: TextSize;
		weight?: TextWeight;
	};
</script>

<script lang="ts">
	let {
		class: className,
		size = "default",
		weight = "normal",
		ref = $bindable(null),
		children,
		...restProps
	}: TextProps = $props();
</script>

<svelte:element this={size === "default" ? "p" : size} class={cn(textVariants({ size, weight }), className)}>
	{@render children?.()}
</svelte:element>
