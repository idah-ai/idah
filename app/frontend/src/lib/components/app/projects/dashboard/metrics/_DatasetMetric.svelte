<script lang="ts">
  import type { Snippet } from "svelte";

  import Text from "@/components/ui/text/Text.svelte";

  import { cn } from "@/utils";

  interface Props {
    title: string;
    value: string;
    description?: string;
    SlotTitle?: Snippet;
    SlotDescription?: Snippet;
    order: number;
  }
  let { title, value, description, SlotTitle, SlotDescription, order }: Props = $props();

  const isLastMetric = $derived(order === 4);
</script>

<div
  class={cn("p-4", {
    "border-b lg:border-r lg:border-b-0": !isLastMetric,
  })}
>
  {#if SlotTitle}
    {@render SlotTitle()}
  {:else}
    <Text size="sm" class="text-muted-foreground">{title}</Text>
  {/if}
  <Text size="h2" weight="semibold" class="tabular-nums">{value}</Text>

  {#if SlotDescription}
    {@render SlotDescription()}
  {:else if description}
    <Text size="sm" class="text-muted-foreground">{description}</Text>
  {/if}
</div>
