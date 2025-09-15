<script lang="ts">
  import Text from "$lib/components/ui/text/Text.svelte";

  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    title?: string;
    slotTitle?: Snippet;
    actions?: Snippet;
  };
  let { ref, title, slotTitle, actions }: Props = $props();
</script>

<div bind:this={ref} class="flex items-center justify-between gap-4">
  {#if slotTitle}
    {@render slotTitle()}
  {:else if title}
    <Text size="h2" weight="semibold">{title}</Text>
  {/if}

  {#if actions}
    {@render actions()}
  {/if}
</div>
