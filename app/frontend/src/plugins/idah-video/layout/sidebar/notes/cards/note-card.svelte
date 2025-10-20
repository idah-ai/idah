<script lang="ts">
  import type { Snippet } from "svelte";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";

  import NoteDropdownMenus from "../dropdown-menus/note-dropdown-menus.svelte";

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
</script>

<div
  role="button"
  tabindex="0"
  class="border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 rounded-lg border-transparent p-2"
  onkeypress={onCardClick}
  onclick={onCardClick}
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

      <NoteDropdownMenus {id} {resource} />
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex min-h-16 flex-1 flex-col items-start gap-1 text-sm">
    <MarkdownPreview value={content_md} />

    {@render contentActions?.()}
  </div>
</div>
