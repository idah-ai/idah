<script lang="ts">
  import type { Snippet } from "svelte";

  import { Label } from "$lib/components/ui/label";

  import { cn } from "$lib/utils";

  // Props
  interface Props {
    required: boolean;
    class?: string | null;
    style?: string;
    children?: Snippet;
  }
  let { required = false, class: className, style, children, ...restProps }: Props = $props();
</script>

<Label
  class={cn(
    "leading-none font-medium",
    {
      "text-muted-foreground": !required,
    },
    className,
  )}
  {style}
  {...restProps}
>
  {@render children?.()}
  {required ? "*" : ""}
</Label>
