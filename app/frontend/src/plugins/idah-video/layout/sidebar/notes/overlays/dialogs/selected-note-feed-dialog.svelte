<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
  import { ScrollArea } from "@/components/ui/scroll-area";

  import ResolveNoteButton from "../../buttons/resolve-note-button.svelte";
  import NoteCard from "../../cards/note-card.svelte";
  import NoteBox from "../../note-box.svelte";
  import { closeNoteFeedPopup, noteSidebarStore } from "../../note-sidebar-stores";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let contentMd = $state<string>("");
  let noteFeed = $derived($noteSidebarStore.noteFeedPopup.noteFeed);

  // Functions
  async function loadNoteComments() {
    if ($noteSidebarStore.noteFeedPopup.noteFeed) {
      const comments = await context.notes.comments.list({
        filters: {
          note_feed_id: noteFeed?.id,
        },
        sort: ["created_at"],
      });

      return comments;
    }

    return [];
  }

  async function createNoteComment() {
    /** Create a note comment under the selected note feed */
    await context.notes.comments.create({
      note_feed_id: noteFeed?.id as string,
      content_md: contentMd,
    });
    toast.success("Comment added successfully.");
    $noteSidebarStore.lastUpdated = new Date();
    contentMd = "";
  }
</script>

{#if noteFeed}
  <Card class="w-[480px] gap-2 py-2">
    <CardHeader class="flex items-center pl-4 pr-2">
      <CardTitle class="text-sm">Comment</CardTitle>
      <div class="ml-auto flex items-center gap-1">
        <ResolveNoteButton {noteFeed}></ResolveNoteButton>

        <Button variant="ghost" size="icon" onclick={closeNoteFeedPopup}>
          <XIcon />
        </Button>
      </div>
    </CardHeader>

    <CardContent class="px-2">
      <ScrollArea orientation="vertical" class="max-h-72 overflow-y-auto">
        <div class="flex max-h-72 flex-col gap-2">
          <NoteCard record={noteFeed} resource="dataset:note_feeds"></NoteCard>

          {#key $noteSidebarStore.lastUpdated}
            {#await loadNoteComments() then noteComments}
              {#each noteComments as noteComment (noteComment.id)}
                <NoteCard
                  record={noteComment}
                  resource="dataset:note_comments"
                  highlighted={$noteSidebarStore.selectedNoteCommentId === noteComment.id}
                ></NoteCard>
              {/each}
            {/await}
          {/key}
        </div>
      </ScrollArea>
    </CardContent>

    <CardFooter class="px-2">
      <NoteBox
        value={contentMd}
        placeholder="Write your comment"
        onInput={(e) => (contentMd = e.currentTarget.value)}
        onSubmit={createNoteComment}
      ></NoteBox>
    </CardFooter>
  </Card>
{/if}
