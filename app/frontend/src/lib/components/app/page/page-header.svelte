<script lang="ts">
  import Text from "$lib/components/ui/text/Text.svelte";

  import type { WithElementRef } from "@/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    title?: string;
    description?: string;
    slotTitle?: Snippet;
    slotDescription?: Snippet;
    actions?: Snippet;
  };
  let { ref, title, description, slotTitle, slotDescription, actions }: Props = $props();
</script>

<div bind:this={ref} class="flex items-center justify-between gap-4">
  <div class="flex flex-col gap-1">
    {#if slotTitle}
      {@render slotTitle()}
    {:else if title}
      <Text size="h2" weight="semibold">{title}</Text>
    {/if}

    {#if slotDescription}
      {@render slotDescription()}
    {:else if description}
      <Text size="default" class="text-muted-foreground">{description}</Text>
    {/if}
  </div>

  {#if actions}
    {@render actions()}
  {/if}
</div>
