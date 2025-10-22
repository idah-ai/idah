<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import { toast } from "svelte-sonner";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { Button } from "@/components/ui/button";
  import { Textarea } from "@/components/ui/textarea";

  import NoteDropdownMenus from "../dropdown-menus/note-dropdown-menus.svelte";
  import { noteSidebarStore } from "../note-sidebar-stores";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    resource: "noteFeed" | "noteComment";
    id: string;
    content_md: string;
    created_by_id: number;
    created_at: string;
    onCardClick?: () => void;

    headerIcon?: Snippet;
    headerActions?: Snippet;
    contentActions?: Snippet;
  }
  let {
    resource,
    id,
    content_md,
    created_by_id,
    created_at,
    onCardClick,
    headerIcon,
    headerActions,
    contentActions,
  }: Props = $props();

  // Contexts
  const context: IActivityContext = getContext("context");

  // Variables
  let mode = $state<"view" | "edit">("view");
  let editedContentMd = $state<string>(content_md);

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
    if (resource === "noteFeed") {
      await context.notes.feeds.update(id, {
        content_md: editedContentMd,
      });
    }

    if (resource === "noteComment") {
      await context.notes.comments.update(id, {
        content_md: editedContentMd,
      });
    }

    toast.success("Comment updated successfully.");
    $noteSidebarStore.lastUpdated = new Date();
  }
</script>

<div
  role="button"
  tabindex="0"
  class="border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 rounded-lg border-transparent p-2"
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
      {@render headerActions?.()}

      <NoteDropdownMenus {id} {resource} onSwitchToEditMode={switchToEditMode} />
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex min-h-16 flex-1 flex-col items-start gap-1 text-sm">
    {#if mode === "view"}
      <MarkdownPreview value={content_md} />

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
