<script lang="ts" module>
  import { Loader2Icon } from "@lucide/svelte";
  import { cn } from "@/utils";
  import { tv, type VariantProps } from "tailwind-variants";

  export const spinnerVariants = tv({
    base: "text-primary animate-spin",
    variants: {
      size: {
        default: "size-6",
        sm: "size-4",
        lg: "size-8",
        xl: "size-10",
        "2xl": "size-12",
      },
    },
    defaultVariants: {
      size: "default",
    },
  });

  export type SpinnerSize = VariantProps<typeof spinnerVariants>["size"];

  export type SpinnerProps = {
    size?: SpinnerSize;
  };
</script>

<script lang="ts">
  let { size = "default" }: SpinnerProps = $props();
</script>

<Loader2Icon class={cn(spinnerVariants({ size }))} />
