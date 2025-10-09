<script lang="ts" module>
  import { LoaderCircleIcon } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";
  import { tv, type VariantProps } from "tailwind-variants";

  import { cn } from "@/utils";

  export const spinnerVariants = tv({
    base: "animate-spin",
    variants: {
      variant: {
        default: "text-primary",
        "primary-foreground": "text-primary-foreground",
      },
      size: {
        default: "size-6",
        sm: "size-4",
        lg: "size-8",
        xl: "size-10",
        "2xl": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type SpinnerVariant = VariantProps<typeof spinnerVariants>["variant"];
  export type SpinnerSize = VariantProps<typeof spinnerVariants>["size"];

  export type SpinnerProps = ComponentProps<typeof LoaderCircleIcon> & {
    variant?: SpinnerVariant;
    size?: SpinnerSize;
  };
</script>

<script lang="ts">
  let { class: className, size = "default", variant = "default", ...restProps }: SpinnerProps = $props();
</script>

<LoaderCircleIcon
  role="status"
  aria-label="Loading"
  class={cn(spinnerVariants({ size, variant }), className)}
  {...restProps}
></LoaderCircleIcon>
