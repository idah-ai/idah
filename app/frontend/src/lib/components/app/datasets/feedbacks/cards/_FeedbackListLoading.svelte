<script lang="ts">
  import * as Card from "@/components/ui/card/index";
  import FeedbackListItemLoading from "@/components/app/datasets/feedbacks/cards/_FeedbackListItemLoading.svelte";
  import Skeleton from "@/components/ui/skeleton/skeleton.svelte";
</script>

<Card.Root class="gap-0 pt-4 pb-0">
  <Card.Header class="border-b px-4 [.border-b]:pb-4">
    <Card.Title>Feedback Items</Card.Title>
    <Card.Description>
      <Skeleton class="h-3 w-1/3" />
    </Card.Description>

    <Card.Action class="flex items-center gap-2">
      <Skeleton class="h-9 w-36" />
    </Card.Action>
  </Card.Header>

  <Card.Content class="px-0">
    {#each Array.from({ length: 5 }) as _loadingItem, i (i)}
      <FeedbackListItemLoading />
    {/each}
  </Card.Content>
</Card.Root>
