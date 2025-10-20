<script lang="ts">
  import { MapPinIcon, MessageSquareIcon, SquareDashedIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { cn } from "@/utils";

  import type { IActivityContext, INoteFeed } from "@/plugin/interface/Activity";

  import NoteDropdownMenus from "./note-dropdown-menus.svelte";
  import { noteSidebarStore } from "./note-sidebar-stores";
  import ResolveNoteButton from "./resolve-note-button.svelte";

  // Props
  interface Props {
    noteFeed: INoteFeed;
  }
  let { noteFeed }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let {
    id,
    // entry_id,
    annotation_id,
    created_by_id,
    anchor_type,
    position,
    status,
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
  function handleClickNoteFeedCard() {
    if (!$noteSidebarStore.selectedNoteFeed) {
      $noteSidebarStore.selectedNoteFeed = noteFeed;
    }
  }

  function replyNoteFeed() {
    if (!$noteSidebarStore.selectedNoteFeed) {
      $noteSidebarStore.selectedNoteFeed = noteFeed;
    }
  }
</script>

<div
  role="button"
  tabindex={0}
  class={cn("border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 rounded-lg border-transparent p-2")}
  onkeypress={handleClickNoteFeedCard}
  onclick={handleClickNoteFeedCard}
>
  <!-- HEADER -->
  <div class="flex w-full gap-2">
    <!-- HEADER::TITLE -->
    <div class="flex flex-1 items-center gap-2">
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

      <div class="flex flex-col -space-y-1 text-left">
        <p class="w-full font-semibold">{created_by_id}@email.com</p>
        <DateText
          class="text-muted-foreground"
          datetime={new Date(created_at)}
          datetimeFormat="MMM dd, yyyy HH:mm:ss"
          size="xs"
          weight="normal"
          showDistance
        ></DateText>
      </div>
    </div>

    <!-- HEADER::ACTIONS -->
    <div class="flex items-center">
      <ResolveNoteButton {noteFeed} />

      <NoteDropdownMenus {id} resource="noteFeed" />
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex min-h-16 flex-1 flex-col items-start gap-1 text-sm">
    <MarkdownPreview value={content_md} />

    {#if isListView}
      <Button
        variant="link"
        size="sm"
        class="pl-0"
        onclick={(e) => {
          e.stopPropagation();
          replyNoteFeed();
        }}
      >
        {#if note_comments.length === 0}
          Reply
        {:else}
          {note_comments.length} {note_comments.length === 1 ? "Reply" : "Replies"}
        {/if}
      </Button>
    {/if}
  </div>
</div>
