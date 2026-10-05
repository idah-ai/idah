<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import ResolveNoteFeedButton from "@/plugin/layout/sidebar/notes/buttons/ResolveNoteFeedButton.svelte";
  import NoteCard from "@/plugin/layout/sidebar/notes/cards/NoteCard.svelte";
  import NoteFeedIcon from "./_NoteFeedIcon.svelte";

  import { NoteCommentRecord, noteCommentsBackendDataSource } from "@/data/model/dataset/notes/comments/record";
  import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
  import { deleteNoteFeed, updateNoteFeedContent } from "@/plugin/layout/sidebar/notes/utils/note-feed.svelte";
  import { AuthContext } from "@/security/AuthContext";

  // Props
  interface Props {
    noteFeedRecord: NoteFeedRecord;
    resolvable?: boolean;
    highlighted?: boolean;
    showReplyCount?: boolean;
    onSelectNoteFeed?: () => void;
    onNoteFeedUpdated?: (updatedNoteFeedRecord: NoteFeedRecord) => Promise<void> | void;
    onNoteFeedDeleted?: () => Promise<void> | void;
  }
  let {
    noteFeedRecord,
    resolvable = false,
    highlighted,
    showReplyCount = false,
    onSelectNoteFeed,
    onNoteFeedUpdated,
    onNoteFeedDeleted,
  }: Props = $props();

  // Variables
  let { id, content_md, feedback_keys, created_by_email, created_at, edited_at, noteType } = $derived(noteFeedRecord);

  let isOwner = $derived(AuthContext.currentAuthContext?.email === created_by_email);

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

  async function updateNoteFeed(params: { editedContentMd: string | null; editedFeedbackKeys: string[] | null }) {
    const { editedContentMd, editedFeedbackKeys } = params;

    const updatedNoteFeedRes = await updateNoteFeedContent({
      id,
      newContentMd: editedContentMd,
      newFeedbackKeys: editedFeedbackKeys,
    });

    if (!updatedNoteFeedRes) return;

    onNoteFeedUpdated?.(updatedNoteFeedRes);
  }
</script>

<NoteCard
  noteFeedId={id}
  {content_md}
  feedbackKeys={feedback_keys}
  {created_by_email}
  {created_at}
  {edited_at}
  editable={isOwner}
  deletable={isOwner}
  {highlighted}
  onClick={selectNoteFeed}
  onUpdate={updateNoteFeed}
  onDelete={async () => {
    await deleteNoteFeed(id);
    await onNoteFeedDeleted?.();
  }}
>
  {#snippet headerIcon()}
    <NoteFeedIcon {noteType} />
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
        <Button variant="link" size="xs" class="ml-auto" onclick={selectNoteFeed}>
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
