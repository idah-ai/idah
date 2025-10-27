<script lang="ts">
  import { MapPinIcon, MessageCircleIcon, SquareDashedIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";

  import ResolveNoteButton from "../buttons/resolve-note-button.svelte";
  import { noteSidebarStore } from "../note-sidebar-stores";
  import NoteCard from "./note-card.svelte";

  // Props
  interface Props {
    noteFeed: INoteFeed;
    highlighted?: boolean;
  }
  let { noteFeed, highlighted }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let { annotation_id, position } = $derived(noteFeed);

  type NoteType = "general" | "annotation" | "video_frame";
  let isListView = $derived(!$noteSidebarStore.selectedNoteFeed);
  let noteType: NoteType = $derived.by(() => {
    if (annotation_id) return "annotation";
    if (Object.keys(position || {}).length > 0) return "video_frame";
    return "general";
  });

  // Functions
  async function loadComments() {
    return await context.notes.comments.list({
      fields: {
        ["dataset:note_comments"]: ["id"],
      },
      filters: {
        note_feed_id: noteFeed.id,
      },
      sort: ["created_at"],
    });
  }

  function selectNoteFeed() {
    switch (noteType) {
      case "general": {
        /** Show note feed detail, if comment type is 'general' */
        $noteSidebarStore.selectedNoteFeed = noteFeed;
        $noteSidebarStore.noteFeedPopup = {
          show: false,
          noteFeed: null,
        };
        break;
      }
      case "annotation":
      case "video_frame": {
        /** Show note feed dialog, if comment type is 'annotation' or 'video_frame' */
        $noteSidebarStore.noteFeedPopup = {
          show: true,
          noteFeed: noteFeed,
        };
        break;
      }
    }
  }
</script>

<NoteCard record={noteFeed} resource="dataset:note_feeds" {highlighted} onCardClick={selectNoteFeed}>
  {#snippet headerIcon()}
    <div
      class={cn("flex size-8 shrink-0 items-center justify-center rounded-full ", {
        "bg-purple-300": noteType === "annotation",
        "bg-yellow-300": noteType === "video_frame",
        "bg-emerald-300": noteType === "general",
      })}
    >
      {#if noteType === "annotation"}
        <SquareDashedIcon class="size-3.5" />
      {:else if noteType === "video_frame"}
        <MapPinIcon class="size-3.5" />
      {:else if noteType === "general"}
        <MessageCircleIcon class="size-3.5" />
      {/if}
    </div>
  {/snippet}

  {#snippet headerActions()}
    <ResolveNoteButton {noteFeed} />
  {/snippet}

  {#snippet contentActions()}
    {#if isListView}
      {#await loadComments() then comments}
        {@const commentCount = comments.length}
        <Button variant="link" size="xs" class="pl-0" onclick={selectNoteFeed}>
          {#if commentCount === 0}
            Reply
          {:else}
            {commentCount} {commentCount === 1 ? "Reply" : "Replies"}
          {/if}
        </Button>
      {/await}
    {/if}
  {/snippet}
</NoteCard>
