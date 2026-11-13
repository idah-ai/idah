<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { cn } from "@/utils";

  interface Props {
    title: string;
    value: string;
    description?: string;
    order: number;
  }
  let { title, value, description, order }: Props = $props();

  const isLastMetric = $derived(order === 4);
</script>

<div
  class={cn("p-4", {
    "border-r": !isLastMetric,
  })}
>
  <Text size="sm" class="text-muted-foreground">{title}</Text>
  <Text size="h2" weight="semibold" class="tabular-nums">{value}</Text>

  {#if description}
    <Text size="sm" class="text-muted-foreground">{description}</Text>
  {/if}
</div>
