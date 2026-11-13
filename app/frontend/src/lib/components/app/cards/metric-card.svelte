<script lang="ts">
  import type { Snippet } from "svelte";

  import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

  // Props
  interface Props {
    title: string;
    value?: string | number;
    slotValue?: Snippet<[{ value?: string | number }]>;
  }
  let { title, value, slotValue }: Props = $props();
</script>

<Card>
  <CardHeader>
    <CardDescription>{title}</CardDescription>
    {#if slotValue}
      {@render slotValue({ value })}
    {:else}
      <CardTitle class="text-2xl">{value}</CardTitle>
    {/if}
  </CardHeader>
</Card>
