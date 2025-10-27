<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import { toast } from "svelte-sonner";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { Button } from "@/components/ui/button";
  import { Textarea } from "@/components/ui/textarea";

  import { cn } from "@/utils";
  import { truncate } from "@/utils/string";

  import NoteDropdownMenus from "../dropdown-menus/note-dropdown-menus.svelte";
  import { noteSidebarStore } from "../note-sidebar-stores";

  import type { IActivityContext, INoteComment, INoteFeed } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    record: INoteFeed | INoteComment;
    resource: "dataset:note_feeds" | "dataset:note_comments";
    highlighted?: boolean;

    onCardClick?: () => void;

    headerIcon?: Snippet;
    headerActions?: Snippet;
    contentActions?: Snippet;
  }
  let { record, resource, highlighted, onCardClick, headerIcon, headerActions, contentActions }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let mode = $state<"view" | "edit">("view");
  let editedContentMd = $state<string>(record.content_md);

  // Functions
  function switchToViewMode() {
    mode = "view";
  }

  function switchToEditMode() {
    mode = "edit";
  }

  function handleClickCard() {
    if (mode === "edit") return;
    onCardClick?.();
  }

  async function updateContentMd() {
    switch (resource) {
      case "dataset:note_feeds": {
        await context.notes.feeds.update(record.id, {
          content_md: editedContentMd,
        });
        break;
      }
      case "dataset:note_comments": {
        await context.notes.comments.update(record.id, {
          content_md: editedContentMd,
        });
        break;
      }
      default:
        break;
    }

    toast.success("Comment updated successfully.");
    $noteSidebarStore.lastUpdated = new Date();
  }

  async function deleteNote() {
    switch (resource) {
      case "dataset:note_feeds": {
        await context.notes.feeds.delete(record.id);
        break;
      }
      case "dataset:note_comments": {
        await context.notes.comments.delete(record.id);
        break;
      }
      default:
        break;
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  class={cn("border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 rounded-lg border-transparent p-2", {
    "bg-secondary": highlighted,
  })}
  onkeypress={handleClickCard}
  onclick={handleClickCard}
>
  <!-- HEADER -->
  <div class="flex w-full gap-2">
    <div class="flex flex-1 items-center gap-2">
      <!-- HEADER::ICON -->
      {@render headerIcon?.()}

      <!-- HEADER::CREATED BY & CREATED AT -->
      <div class="flex flex-col -space-y-1 text-left">
        <p class="w-full text-sm font-semibold">{record.created_by_id}@email.com</p>
        <DateText
          class="text-muted-foreground"
          datetime={new Date(record.created_at)}
          datetimeFormat="MMM dd, yyyy HH:mm:ss"
          size="xs"
          weight="normal"
          showDistance
        ></DateText>
      </div>
    </div>

    <!-- HEADER::ACTIONS -->
    <div class="flex items-center">
      {@render headerActions?.()}

      <NoteDropdownMenus
        noteFeedId={resource === "dataset:note_feeds"
          ? (record as INoteFeed).id
          : (record as INoteComment).note_feed_id}
        noteCommentId={resource === "dataset:note_comments" ? (record as INoteComment).id : undefined}
        onSwitchToEditMode={switchToEditMode}
        onDelete={deleteNote}
      />
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex flex-1 flex-col items-start gap-1 text-sm">
    {#if mode === "view"}
      <MarkdownPreview value={truncate(record.content_md, 140)} />
      {#if record.created_at !== record.updated_at}
        <span class="text-muted-foreground text-xs">(Edited)</span>
      {/if}

      {@render contentActions?.()}
    {/if}

    {#if mode === "edit"}
      <Textarea value={editedContentMd} oninput={(e) => (editedContentMd = e.currentTarget.value)} />

      <div class="ml-auto mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={(e) => {
            e.stopPropagation();
            switchToViewMode();
          }}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          onclick={(e) => {
            e.stopPropagation();
            updateContentMd();
          }}
        >
          Save
        </Button>
      </div>
    {/if}
  </div>
</div>
