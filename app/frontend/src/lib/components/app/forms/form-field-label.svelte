<script lang="ts">
  import type { Snippet } from "svelte";

  import { Label } from "$lib/components/ui/label";

  import { cn } from "$lib/utils";

  // Props
  interface Props {
    required: boolean;
    class?: string | null;
    children?: Snippet;
  }
  let { required = false, class: className, children, ...restProps }: Props = $props();
</script>

<Label
  class={cn(
    "leading-none font-medium",
    {
      "text-muted-foreground": !required,
    },
    className,
  )}
  {...restProps}
>
  {@render children?.()}
  {required ? "*" : ""}
</Label>
