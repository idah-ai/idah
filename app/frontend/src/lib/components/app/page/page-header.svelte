<script lang="ts">
  import { InfoIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Text from "$lib/components/ui/text/Text.svelte";

  import type { WithElementRef } from "@/utils";

  // Props
  type Props = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    title?: string;
    description?: string;
    // Shown in a tooltip from an info icon beside the title, instead of under it.
    info?: string;
    slotTitle?: Snippet;
    slotDescription?: Snippet;
    actions?: Snippet;
  };
  let { ref, title, description, info, slotTitle, slotDescription, actions }: Props = $props();
</script>

<div bind:this={ref} class="flex w-full items-center justify-between">
  <div class="flex w-full flex-col gap-1">
    {#if slotTitle}
      {@render slotTitle()}
    {:else if title}
      <div class="flex items-center gap-2">
        <Text size="h2" weight="semibold">{title}</Text>

        {#if info}
          <Tooltips side="bottom" class="text-muted-foreground hover:text-foreground rounded-full transition-colors">
            {#snippet trigger()}
              <InfoIcon class="size-4" />
              <span class="sr-only">About {title}</span>
            {/snippet}

            {#snippet content()}
              <p class="max-w-xs">{info}</p>
            {/snippet}
          </Tooltips>
        {/if}
      </div>
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
