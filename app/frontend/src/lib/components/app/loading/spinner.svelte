<script lang="ts" module>
  import { Loader2Icon } from "@lucide/svelte";
  import { cn } from "@/utils";
  import { tv, type VariantProps } from "tailwind-variants";

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

  export type SpinnerProps = {
    variant?: SpinnerVariant;
    size?: SpinnerSize;
  };
</script>

<script lang="ts">
  let { size = "default", variant = "default" }: SpinnerProps = $props();
</script>

<Loader2Icon class={cn(spinnerVariants({ size, variant }))} />
