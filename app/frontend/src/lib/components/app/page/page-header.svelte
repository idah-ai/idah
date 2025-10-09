<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import Text from "$lib/components/ui/text/Text.svelte";

  import type { WithElementRef } from "@/utils";

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

<div bind:this={ref} class="flex w-full items-center justify-between">
  <div class="flex w-full flex-col gap-1">
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

  <div class="flex items-center justify-end gap-2">
    {#if actions}
      {@render actions()}
    {/if}
  </div>
</div>
