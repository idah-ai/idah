<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Badge from "@/components/ui/badge/badge.svelte";

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

<Tooltips align="start" class="w-fit min-w-0" delayDuration={1000}>
  {#snippet trigger()}
    <Badge variant={feedbackItem ? "info" : "destructive"} class="max-w-60 justify-start text-left">
      <span class="truncate">
        {feedbackItem ? feedbackItem.label : "Feedback not found"}
      </span>
    </Badge>
  {/snippet}

  {#snippet content()}
    {feedbackItem ? feedbackItem.description : "Feedback not found"}
  {/snippet}
</Tooltips>
