<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { MessageSquareDashedIcon } from "@lucide/svelte";

  import AddFeedbackItemButton from "@/components/app/datasets/feedbacks/buttons/AddFeedbackItemButton.svelte";

  import * as Card from "@/components/ui/card/index";
  import FeedbackListItem from "@/components/app/datasets/feedbacks/cards/FeedbackListItem.svelte";
  import FeedbackListLoading from "@/components/app/datasets/feedbacks/cards/_FeedbackListLoading.svelte";
  import FeedbackItemFormModal from "@/components/app/datasets/feedbacks/overlays/FeedbackItemFormModal.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";

  interface Props {
    title?: string;
    description?: string;
    isTemplate?: boolean;
  }
  let { title = "Feedback Items", description, isTemplate }: Props = $props();

  const datasetId = page.params.datasetId as string;
  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);
</script>

{#await controller.loadKeysInUse(datasetId)}
  <FeedbackListLoading />
{:then { keys: keysInUse }}
  <Card.Root class="gap-0 pt-4 pb-0">
    <Card.Header class="border-b px-4 [.border-b]:pb-4">
      <Card.Title>{title}</Card.Title>

      {#if description}
        <Card.Description>{description}</Card.Description>
      {/if}

      <Card.Action class="flex items-center gap-2">
        <AddFeedbackItemButton />
      </Card.Action>
    </Card.Header>

    <Card.Content class="px-0">
      {#each controller.config.entries() as [feedbackItemKey, feedbackItem] (feedbackItemKey)}
        <FeedbackListItem {feedbackItemKey} {feedbackItem} {isTemplate} {keysInUse} />
      {:else}
        <ResponseBlock
          title="No feedback items yet."
          description="Add your first feedback item so reviewers can attach it to notes."
          icon={MessageSquareDashedIcon}
        >
          {#snippet actions()}
            <AddFeedbackItemButton />
          {/snippet}
        </ResponseBlock>
      {/each}
    </Card.Content>
  </Card.Root>

  <FeedbackItemFormModal />
{/await}
