<script lang="ts">
  import { MapPinIcon, MessageCircleIcon, SquareDashedIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/resolve-note-feed-button.svelte";
  import NoteCard from "@/plugin/layout/sidebar/notes/cards/note-card.svelte";

  import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
  import { deleteNoteFeed, updateNoteFeedContentMd } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { cn } from "@/utils";

  // Props
  interface Props {
    noteFeedRecord: NoteFeedRecord;
    resolvable?: boolean;
    editable?: boolean;
    deletable?: boolean;
    highlighted?: boolean;
    showReplyCount?: boolean;
    onSelectNoteFeed?: () => void;
    onNoteFeedUpdated?: (updatedNoteFeedRecord: NoteFeedRecord) => Promise<void> | void;
  }
  let {
    noteFeedRecord,
    resolvable = false,
    editable = false,
    deletable = false,
    highlighted,
    showReplyCount = false,
    onSelectNoteFeed,
    onNoteFeedUpdated,
  }: Props = $props();

  // Variables
  let { id, content_md, created_by_email, created_at, edited_at, noteType } = $derived(noteFeedRecord);

  // Functions
  function selectNoteFeed() {
    onSelectNoteFeed?.();
  }

  async function loadComments() {
    const noteCommentsRes = await noteCommentsBackendDataSource.list({
      fields: {
        [NoteCommentRecord.type]: ["id"],
      },
      filters: {
        note_feed_id: noteFeedRecord.id,
      },
    });
    return noteCommentsRes.data;
  }

  async function updateNoteFeed(editedContentMd: string) {
    const updatedNoteFeedRes = await updateNoteFeedContentMd(id, editedContentMd);
    onNoteFeedUpdated?.(updatedNoteFeedRes);
  }
</script>

<NoteCard
  noteFeedId={id}
  {content_md}
  {created_by_email}
  {created_at}
  {edited_at}
  {editable}
  {deletable}
  {highlighted}
  onClick={selectNoteFeed}
  onUpdateContentMd={updateNoteFeed}
  onDelete={() => deleteNoteFeed(id)}
>
  {#snippet headerIcon()}
    <div
      class={cn("dark:text-accent flex size-8 shrink-0 items-center justify-center rounded-full", {
        "bg-purple-300": noteType === "annotation",
        "bg-yellow-300 ": noteType === "video_frame",
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
    {#if resolvable}
      <ResolveNoteFeedButton noteFeed={noteFeedRecord} />
    {/if}
  {/snippet}

  {#snippet contentActions()}
    {#if showReplyCount}
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
