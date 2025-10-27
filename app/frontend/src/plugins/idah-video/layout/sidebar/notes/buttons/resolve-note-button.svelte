<script lang="ts">
  import { CheckIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";

  import { cn } from "@/utils";
  import { noteSidebarStore } from "../note-sidebar-stores";

  // Props
  interface Props {
    noteFeed: INoteFeed;
  }
  let { noteFeed }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let { id, status } = $derived(noteFeed);
  let isResolved = $derived(status === "resolved");

  // Functions
  async function markAsResolved() {
    if (isResolved) return;

    const resolvedNoteFeed = await context.notes.feeds.markAsResolved(id);
    toast.success("Comment marked as resolved");
    $noteSidebarStore.lastUpdated = new Date();
    $noteSidebarStore.noteFeedPopup.noteFeed = resolvedNoteFeed;
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
