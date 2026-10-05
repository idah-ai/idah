<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import Badge from "@/components/ui/badge/badge.svelte";
  import * as HoverCard from "@/components/ui/hover-card/index";

  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  interface Props {
    feedbackKey: string;
  }
  let { feedbackKey }: Props = $props();

  if (!hasContext("driver")) {
    throw new Error(
      'NoteFeedbackBadge is require "driver" context for display "label" and "description". Please setContext("driver", driver) at the parent component.',
    );
  }

  const driver: IdahDriverV2 = getContext("driver");
  const feedbackConfigMap = new SvelteMap(Object.entries(driver.feedbackConfig));
  const feedbackItem = $derived(feedbackConfigMap.get(feedbackKey));
</script>

<HoverCard.Root openDelay={700}>
  <HoverCard.Trigger class="w-fit min-w-0">
    <Badge variant={feedbackItem ? "info" : "destructive"} class="max-w-60 justify-start text-left">
      <span class="truncate">
        {feedbackItem ? feedbackItem.label : "Feedback not found"}
      </span>
    </Badge>
  </HoverCard.Trigger>

  <HoverCard.Content class="p-2">
    <div class="flex flex-col gap-2 text-xs">
      {#if feedbackItem}
        <span class="font-medium">{feedbackItem.label}</span>
        <span class="text-muted-foreground">{feedbackItem.description}</span>
      {:else}
        <span class="text-destructive font-medium">Cannot find feedback item.</span>
      {/if}
    </div>
  </HoverCard.Content>
</HoverCard.Root>
