<script lang="ts">
  import type { Snippet } from "svelte";

  import { Label } from "$lib/components/ui/label";

  import { cn } from "$lib/utils";

  // Props
  interface Props {
    required: boolean;
    class?: string | null;
    onclick?: () => void;
    children?: Snippet;
  }
  let { required = false, class: className, onclick, children, ...restProps }: Props = $props();
</script>

<Label
  class={cn(
    "leading-none font-medium",
    {
      "text-muted-foreground": !required,
    },
    className,
  )}
  {onclick}
  {...restProps}
>
  {@render children?.()}
  {required ? "*" : ""}
</Label>
