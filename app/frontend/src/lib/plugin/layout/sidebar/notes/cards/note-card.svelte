<script lang="ts">
  import type { Snippet } from "svelte";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import { Textarea } from "@/components/ui/textarea";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";

  import { cn } from "@/utils";
  import { truncate } from "@/utils/string";

  // Props
  interface Props {
    noteFeedId: string;
    noteCommentId?: string;
    content_md: string;
    edited_at?: Date | string | null;
    created_by_email: string;
    created_at: Date | string;

    editable?: boolean;
    deletable?: boolean;
    highlighted?: boolean;

    onClick?: () => void;
    onUpdateContentMd: (newContentMd: string) => Promise<void>;
    onDelete?: () => Promise<void>;

    headerIcon?: Snippet;
    headerActions?: Snippet;
    contentActions?: Snippet;
  }
  let {
    noteFeedId,
    noteCommentId,
    content_md,
    edited_at,
    created_by_email,
    created_at,
    editable = false,
    deletable = false,
    highlighted = false,
    onClick,
    onUpdateContentMd,
    onDelete,
    headerIcon,
    headerActions,
    contentActions,
  }: Props = $props();

  // Variables
  let editedContentMd = $state<string>(content_md);
  let mode = $state<"view" | "edit">("view");
  let isEditMode = $derived(mode === "edit");
  let isViewMode = $derived(mode === "view");

  // Functions
  function switchToViewMode() {
    mode = "view";
  }

  function switchToEditMode() {
    mode = "edit";
  }

  function handleClickCard() {
    if (mode === "edit") return;
    onClick?.();
  }
</script>

<div
  role="button"
  tabindex="0"
  class={cn("border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 border-transparent p-2", {
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
      <div class="flex flex-col -space-y-1 text-left text-xs">
        <p class="w-full font-semibold">{created_by_email}</p>
        <DateText
          class="text-muted-foreground"
          datetime={new Date(created_at)}
          datetimeFormat="MMM dd, yyyy HH:mm:ss"
          size="xs"
          weight="normal"
          showDistance
        ></DateText>
      </div>

      <!-- HEADER::ACTIONS -->
      <div class="ml-auto flex items-center">
        {@render headerActions?.()}

        <NoteDropdownMenus
          {noteFeedId}
          {noteCommentId}
          {editable}
          {deletable}
          onSwitchToEditMode={switchToEditMode}
          {onDelete}
        />
      </div>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex flex-1 flex-col items-start gap-1 text-xs">
    {#if isViewMode}
      <MarkdownPreview value={truncate(content_md, 140)} />

      {#if edited_at}
        <span class="text-muted-foreground text-xs">(Edited)</span>
      {/if}

      {@render contentActions?.()}
    {/if}

    {#if isEditMode}
      <Textarea value={editedContentMd} oninput={(e) => (editedContentMd = e.currentTarget.value)} />

      <div class="ml-auto mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={(e) => {
            e.stopPropagation();
            editedContentMd = content_md;
            switchToViewMode();
          }}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          onclick={async (e) => {
            e.stopPropagation();
            await onUpdateContentMd(editedContentMd);
            switchToViewMode();
          }}
        >
          Save
        </Button>
      </div>
    {/if}
  </div>
</div>
