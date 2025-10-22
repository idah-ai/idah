<script lang="ts">
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import NoteBox from "../../note-box.svelte";
  import { closeNoteFeedPopup, noteSidebarStore } from "../../note-sidebar-stores";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let contentMd = $state<string>("");

  // Functions
  async function createNoteFeed() {
    /** Create new note feed at specific position */
    const createdNoteFeed = await context.notes.feeds.create({
      anchor_type: "entry",
      content_md: contentMd,
      position: { ...$noteSidebarStore.noteFeedPopup.noteFeed?.position },
    });

    /** Create new note feed at specific annotation */

    $noteSidebarStore.noteFeedPopup = {
      show: true,
      noteFeed: createdNoteFeed,
    };

    toast.success("Note created successfully.");
    $noteSidebarStore.lastUpdated = new Date();
    closeNoteFeedPopup();
    contentMd = "";
  }
</script>

<NoteBox
  value={contentMd}
  placeholder="Write your comment"
  onInput={(e) => (contentMd = e.currentTarget.value)}
  onSubmit={createNoteFeed}
></NoteBox>
