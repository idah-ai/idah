<script lang="ts">
  import type { Snippet } from "svelte";

  import DateText from "@/components/app/texts/date-text.svelte";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/NoteDropdownMenus.svelte";
  import NoteFeedbackBadges from "@/plugin/layout/sidebar/notes/badges/NoteFeedbackBadges.svelte";
  import NoteForm from "@/plugin/layout/sidebar/notes/inputs/NoteForm.svelte";

  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { cn } from "@/utils";
  import { truncate, truncateEmail } from "@/utils/string";

  // Props
  interface Props {
    noteFeedId: string;
    noteCommentId?: string;
    content_md: string | null;
    feedbackKeys: string[] | null;
    edited_at?: Date | string | null;
    created_by_email: string;
    created_at: Date | string;

    editable?: boolean;
    deletable?: boolean;
    highlighted?: boolean;

    onClick?: () => void;
    onUpdate: (params: { editedContentMd: string | null; editedFeedbackKeys: string[] | null }) => Promise<void>;
    onDelete?: () => Promise<void>;

    headerIcon?: Snippet;
    headerActions?: Snippet;
    contentActions?: Snippet;
  }
  let {
    noteFeedId,
    noteCommentId,
    content_md,
    feedbackKeys,
    edited_at,
    created_by_email,
    created_at,
    editable = false,
    deletable = false,
    highlighted = false,
    onClick,
    onUpdate,
    onDelete,
    headerIcon,
    headerActions,
    contentActions,
  }: Props = $props();

  // Variables
  let editedContentMd = $state<string | null>(content_md);
  let editedFeedbackKeys = $state<string[]>(feedbackKeys ?? []);
  let mode = $state<"view" | "edit">("view");
  let isEditMode = $derived(mode === "edit");
  let isViewMode = $derived(mode === "view");
  const isNoteComment = $derived(noteCommentId !== undefined);

  function formatEditedTooltip(dateStr?: Date | string | null): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return (
        "Edited " +
        d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return "";
    }
  }

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
  class={cn("hover:bg-primary/5 flex cursor-pointer gap-2 border-b p-2", { "bg-secondary": highlighted })}
  onkeypress={handleClickCard}
  onclick={handleClickCard}
>
  <!-- ICONS -->
  <section class="shrink-0">
    {@render headerIcon?.()}
  </section>

  <!-- CONTENT -->
  <section class="flex flex-1 flex-col gap-2">
    <!-- CONTENT::EMAIL, CREATED AT, ACTIONS -->
    <div class="flex items-center">
      <div class="flex flex-col text-xs">
        <p class="flex-1 font-semibold">{truncateEmail(created_by_email)}</p>

        <div>
          <DateText
            class="text-muted-foreground"
            datetime={new Date(created_at)}
            datetimeFormat="MMM dd, yyyy HH:mm:ss"
            size="xs"
            weight="normal"
            showDistance
          ></DateText>

          {#if edited_at}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger class="inline-block">
                  <span class="text-muted-foreground text-xs">• Edited</span>
                </TooltipTrigger>
                <TooltipContent>{formatEditedTooltip(edited_at)}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          {/if}
        </div>
      </div>

      <div class="ml-auto flex items-center">
        {@render headerActions?.()}

        <NoteDropdownMenus
          {noteFeedId}
          {noteCommentId}
          editable={editable && isViewMode}
          {deletable}
          onSwitchToEditMode={switchToEditMode}
          {onDelete}
        />
      </div>
    </div>

    <!-- FEEDBACK KEYS -->
    <NoteFeedbackBadges feedbackKeys={feedbackKeys ?? []} />

    <!-- CONTENT MD -->
    {#if isViewMode}
      <MarkdownPreview class="text-xs" value={truncate(content_md ?? "", 140)} />

      {@render contentActions?.()}
    {/if}

    <!-- EDIT FORM -->
    {#if isEditMode}
      <NoteForm
        showFeedbackField={!isNoteComment}
        feedbackValues={editedFeedbackKeys}
        onFeedbackSelected={(selected) => (editedFeedbackKeys = selected)}
        contentValue={editedContentMd}
        onContentChange={(newValue) => (editedContentMd = newValue)}
        submitLabel="Save"
        onSubmit={async () => {
          await onUpdate({ editedContentMd, editedFeedbackKeys });
          switchToViewMode();
        }}
        showCancel
        onCancel={() => {
          editedContentMd = content_md;
          editedFeedbackKeys = feedbackKeys ?? [];
          switchToViewMode();
        }}
      />
    {/if}
  </section>
</div>
