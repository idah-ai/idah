<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { cn } from "@/utils";
  import type { Snippet } from "svelte";

  // Props
  type Value = string | number | boolean | Date | null | undefined;
  interface Props {
    label?: string;
    value?: Value;
    direction?: "horizontal" | "vertical";
    slotLabel?: Snippet<[{ label?: string }]>;
    slotValue?: Snippet<[{ value?: Value }]>;
  }
  let { label, value = null, direction = "horizontal", slotLabel, slotValue }: Props = $props();
</script>

<div
  id="data-display-container"
  class={cn("flex", {
    "flex-row items-center gap-1": direction === "horizontal",
    "flex-col gap-1": direction === "vertical",
  })}
>
  {#if slotLabel}
    {@render slotLabel({ label })}
  {:else}
    <Text size="sm" class="text-muted-foreground">{label}:</Text>
  {/if}

  {#if slotValue}
    {@render slotValue({ value })}
  {:else}
    <Text size="sm" class="text-muted-foreground">{value}</Text>
  {/if}
</div>
