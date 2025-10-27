<script lang="ts">
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";

  import type { VideoAnnotation } from "../../../../../video-annotation-activity/VideoAnnotationContext";
  import NoteBox from "../../note-box.svelte";
  import { closeNoteFeedPopup, noteSidebarStore } from "../../note-sidebar-stores";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let contentMd = $state<string>("");

  // Functions
  async function createNoteFeed() {
    const annotationId: string | undefined = $noteSidebarStore.noteFeedPopup.noteFeed?.position["metadata"]
      ? ($noteSidebarStore.noteFeedPopup.noteFeed?.position as unknown as VideoAnnotation).metadata.id
      : undefined;

    /** Create new note feed at specific position */
    const createdNoteFeed = await context.notes.feeds.create({
      anchor_type: "entry",
      content_md: contentMd,
      annotation_id: annotationId,
      position: { ...$noteSidebarStore.noteFeedPopup.noteFeed?.position },
    });

    if (annotationId || Object.keys($noteSidebarStore.noteFeedPopup.noteFeed?.position || {}).length > 0) {
      $noteSidebarStore.noteFeedPopup = {
        show: true,
        noteFeed: createdNoteFeed,
      };
    } else {
      closeNoteFeedPopup();
    }

    toast.success("Note created successfully.");
    $noteSidebarStore.lastUpdated = new Date();
    contentMd = "";
  }
</script>

<NoteBox
  value={contentMd}
  placeholder="Write your comment"
  onInput={(e) => (contentMd = e.currentTarget.value)}
  onSubmit={createNoteFeed}
></NoteBox>
