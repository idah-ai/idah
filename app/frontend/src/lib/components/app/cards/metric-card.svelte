<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Card from "@/components/ui/card/index";

  // Props
  interface Props {
    title: string;
    value?: string | number;
    SlotValue?: Snippet<[{ value?: string | number }]>;
  }
  let { title, value, SlotValue }: Props = $props();
</script>

<Card.Root>
  <Card.Header>
    <Card.Description>{title}</Card.Description>

    {#if SlotValue}
      {@render SlotValue({ value })}
    {:else}
      <Card.Title class="text-2xl">{value}</Card.Title>
    {/if}
  </Card.Header>
</Card.Root>
