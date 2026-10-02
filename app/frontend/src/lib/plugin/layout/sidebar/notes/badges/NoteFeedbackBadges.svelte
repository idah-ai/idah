<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import NoteFeedbackBadge from "@/plugin/layout/sidebar/notes/badges/NoteFeedbackBadge.svelte";

  interface Props {
    feedbackKeys: string[];
  }
  let { feedbackKeys }: Props = $props();

  const DEFAULT_MAX_SHOWN: number = 2;
  let maxShown: number = $state(DEFAULT_MAX_SHOWN);

  const visibleFeedbackKeys = $derived(feedbackKeys.slice(0, maxShown));
  const hiddenFeedbackKeys = $derived(feedbackKeys.slice(maxShown));

  /** Show the controller badge when feedback keys is greather then max show */
  const showController = $derived(feedbackKeys.length > DEFAULT_MAX_SHOWN);

  const isShowingMax = $derived(maxShown === feedbackKeys.length);

  function toggleVisibility(e: MouseEvent) {
    e.stopPropagation();

    if (maxShown === DEFAULT_MAX_SHOWN) {
      maxShown = feedbackKeys.length;
    } else {
      maxShown = DEFAULT_MAX_SHOWN;
    }
  }
</script>

<div class="mt-1 grid min-w-0 gap-1">
  {#each visibleFeedbackKeys as feedbackKey (feedbackKey)}
    <NoteFeedbackBadge {feedbackKey} />
  {/each}

  {#if showController}
    <Badge variant="outline" class="cursor-pointer" onclick={toggleVisibility}>
      {#if isShowingMax}
        Show less
      {:else}
        + {hiddenFeedbackKeys.length} more
      {/if}
    </Badge>
  {/if}
</div>
