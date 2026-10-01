<script lang="ts">
  import { getContext } from "svelte";
  import { MessageSquareDashedIcon } from "@lucide/svelte";

  import AddFeedbackItemButton from "@/components/app/datasets/feedbacks/buttons/AddFeedbackItemButton.svelte";

  import * as Card from "@/components/ui/card/index";
  import FeedbackListItem from "@/components/app/datasets/feedbacks/cards/FeedbackListItem.svelte";
  import FeedbackItemFormModal from "@/components/app/datasets/feedbacks/overlays/FeedbackItemFormModal.svelte";
  import ResponseBlock from "@/components/app/blocks/response-block.svelte";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";

  interface Props {
    title?: string;
    description?: string;
  }
  let { title = "Feedback Items", description }: Props = $props();

  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);
</script>

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
      <FeedbackListItem {feedbackItemKey} {feedbackItem} />
    {:else}
      <ResponseBlock
        title="No feedback items yet."
        description="Create feedback items to give reviewers clear, consistent guidance when reviewing this dataset."
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
