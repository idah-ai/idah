<script lang="ts">
  import DateText from "@/components/app/texts/date-text.svelte";

  import { cn } from "@/utils";

  import MarkdownPreview from "@/components/app/markdown/markdown-preview.svelte";

  import NoteDropdownMenus from "./note-dropdown-menus.svelte";

  import type { INoteComment } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    noteComment: INoteComment;
  }
  let { noteComment }: Props = $props();

  // Variables
  let { id, content_md, created_by_id, created_at } = $derived(noteComment);
</script>

<div
  role="button"
  tabindex="0"
  class={cn("border-1 hover:bg-secondary group flex cursor-pointer flex-col gap-2 rounded-lg border-transparent p-2")}
  onkeypress={() => {}}
  onclick={() => {}}
>
  <!-- HEADER -->
  <div class="flex w-full gap-2">
    <!-- HEADER::TITLE -->
    <div class="flex flex-1 items-center gap-2">
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
      <NoteDropdownMenus {id} resource="noteComment" />
    </div>
  </div>

  <!-- CONTENT -->
  <div class="flex min-h-16 flex-1 flex-col items-start gap-1 text-sm">
    <MarkdownPreview value={content_md} />
  </div>
</div>
