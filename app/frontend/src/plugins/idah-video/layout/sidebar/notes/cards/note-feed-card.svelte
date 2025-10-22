<script lang="ts">
  import { MapPinIcon, MessageSquareIcon, SquareDashedIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { INoteFeed } from "@/plugin/interface/Activity";

  import ResolveNoteButton from "../buttons/resolve-note-button.svelte";
  import { noteSidebarStore } from "../note-sidebar-stores";
  import NoteCard from "./note-card.svelte";

  // Props
  interface Props {
    noteFeed: INoteFeed;
  }
  let { noteFeed }: Props = $props();

  // Variables
  let {
    id,
    // entry_id,
    annotation_id,
    created_by_id,
    // anchor_type,
    position,
    // status,
    content_md,
    created_at,
    note_comments,
  } = $derived(noteFeed);

  type CommentType = "general" | "annotation" | "video_frame";
  let isListView = $derived(!$noteSidebarStore.selectedNoteFeed);
  let commentType: CommentType = $derived.by(() => {
    if (annotation_id) return "annotation";
    if (Object.keys(position || {}).length > 0) return "video_frame";
    return "general";
  });

  // Functions
  function selectNoteFeed() {
    switch (commentType) {
      case "general": {
        /** Show note feed detail, if comment type is 'general' */
        $noteSidebarStore.selectedNoteFeed = noteFeed;
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

<NoteCard resource="noteFeed" {id} {content_md} {created_by_id} {created_at} onCardClick={selectNoteFeed}>
  {#snippet headerIcon()}
    <div
      class={cn("flex size-8 shrink-0 items-center justify-center rounded-full ", {
        "bg-purple-300": commentType === "annotation",
        "bg-yellow-300": commentType === "video_frame",
        "bg-emerald-300": commentType === "general",
      })}
    >
      {#if commentType === "annotation"}
        <SquareDashedIcon class="size-3.5" />
      {:else if commentType === "video_frame"}
        <MapPinIcon class="size-3.5" />
      {:else if commentType === "general"}
        <MessageSquareIcon class="size-3.5" />
      {/if}
    </div>
  {/snippet}

  {#snippet headerActions()}
    <ResolveNoteButton {noteFeed} />
  {/snippet}

  {#snippet contentActions()}
    {#if isListView}
      <Button variant="link" size="sm" class="pl-0" onclick={selectNoteFeed}>
        {#if note_comments.length === 0}
          Reply
        {:else}
          {note_comments.length} {note_comments.length === 1 ? "Reply" : "Replies"}
        {/if}
      </Button>
    {/if}
  {/snippet}
</NoteCard>
