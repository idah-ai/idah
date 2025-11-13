<script lang="ts">
  import { CheckIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { NoteFeedRecord, noteFeedsBackendDataSource } from "@/data/model/dataset/notes/feeds/record";

  import { cn } from "@/utils";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    noteFeed: NoteFeedRecord;
    onNoteResolved?: (resolvedNoteFeed: NoteFeedRecord) => void;
  }
  let { noteFeed, onNoteResolved }: Props = $props();

  // Variables
  let { id, status } = $derived(noteFeed);
  let isResolved = $derived(status === "resolved");

  // Functions
  async function markAsResolved() {
    if (isResolved) return;

    const resolvedNoteFeedRes = await noteFeedsBackendDataSource.markAsResolved(id);
    onNoteResolved?.(resolvedNoteFeedRes.data);
    toast.success("Note feed marked as resolved successfully.");
    $refetches.noteFeeds.list = new Date();
  }
</script>

<Tooltips align="center" ignoreNonKeyboardFocus>
  {#snippet trigger()}
    <Button
      variant={isResolved ? "success" : "secondary"}
      size="icon"
      class={cn("size-5 rounded-full")}
      onclick={(e) => {
        e.stopPropagation();
        markAsResolved();
      }}
    >
      <CheckIcon class="size-3" />
    </Button>
  {/snippet}

  {#snippet content()}
    {isResolved ? "Resolved" : "Mark as Resolved"}
  {/snippet}
</Tooltips>
