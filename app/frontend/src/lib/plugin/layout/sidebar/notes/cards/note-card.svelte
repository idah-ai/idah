<script lang="ts">
  import type { Snippet } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import NoteDropdownMenus from "@/plugin/layout/sidebar/notes/dropdown-menus/note-dropdown-menus.svelte";
  import NoteFeedbackBadges from "@/plugin/layout/sidebar/notes/badges/NoteFeedbackBadges.svelte";
  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import MultipleSelectFeedbacksField from "@/plugin/layout/sidebar/notes/inputs/MultipleSelectFeedbacksField.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";

  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

  import { cn } from "@/utils";
  import { truncate, truncateEmail } from "@/utils/string";
  import type { Resource } from "@/security/types";

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
  const resource: Resource = "dataset:note_feeds";

  let editedContentMd = $state<string | null>(content_md);
  let editedFeedbackKeys = $state<string[]>(feedbackKeys ?? []);
  let mode = $state<"view" | "edit">("view");
  let isEditMode = $derived(mode === "edit");
  let isViewMode = $derived(mode === "view");
  let disabledSaveButton = $derived(!editedContentMd?.trim() && editedFeedbackKeys.length === 0);

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
  class={cn("hover:bg-secondary group flex cursor-pointer flex-col gap-2 border-1 border-transparent p-2", {
    "bg-secondary": highlighted,
  })}
  onkeypress={handleClickCard}
  onclick={handleClickCard}
>
  <!-- HEADER -->
  <div class="flex w-full gap-2">
    <div class="flex flex-1 items-start gap-2">
      <!-- HEADER::ICON -->
      {@render headerIcon?.()}

      <!-- HEADER::CREATED BY & CREATED AT & FEEDBACKS -->
      <div class="flex min-w-0 flex-1 flex-col text-left text-xs">
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

        <NoteFeedbackBadges feedbackKeys={feedbackKeys ?? []} />
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
  <div class="flex flex-1 flex-col items-start gap-1 overflow-x-hidden text-xs">
    {#if isViewMode}
      <MarkdownPreview value={truncate(content_md ?? "", 140)} />

      {@render contentActions?.()}
    {/if}

    {#if isEditMode}
      <div class="grid w-full gap-2">
        <MultipleSelectFeedbacksField
          values={editedFeedbackKeys}
          onSelected={(selected) => (editedFeedbackKeys = selected)}
        />

        <TextareaField
          name="{resource}/content_md"
          label="Comment"
          value={editedContentMd}
          oninput={(e) => (editedContentMd = e.currentTarget.value)}
        />
      </div>

      <div class="mt-2 ml-auto flex items-center gap-2">
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
          disabled={disabledSaveButton}
          onclick={async (e) => {
            e.stopPropagation();
            await onUpdate({ editedContentMd, editedFeedbackKeys });
            switchToViewMode();
          }}
        >
          Save
        </Button>
      </div>
    {/if}
  </div>
</div>
