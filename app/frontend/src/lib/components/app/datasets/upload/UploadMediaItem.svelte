<script lang="ts">
  import { ChevronDownIcon, ChevronRightIcon, FileIcon } from "@lucide/svelte";

  import Spinner from "@/components/ui/spinner/spinner.svelte";

  import UploadItemCollapsibleSection from "./UploadItemCollapsibleSection.svelte";
  import UploadItemStatusIcon from "./_UploadItemStatusIcon.svelte";

  import { pluralizeUnit } from "@/utils/unit";
  import { getStatusLabel } from "./upload-item-utils";

  import type { UploadItemView } from "@/components/app/datasets/upload/upload-item.types";

  // One compact row of an upload summary: status icon, name, one status line, and the
  // skipped/failed files of a zip or folder behind a toggle. Meant to sit in a bordered,
  // divided list.
  interface Props {
    uploadItem: UploadItemView;
    maxRetries?: number;
    title?: string; // replaces the item's name, e.g. with the dataset it went to
    label?: string; // replaces the status line once completed
    warning?: boolean; // shows a warning once completed, e.g. for files left out on purpose
    entries?: string[]; // a zip or folder: the entries it created, listed behind its status line
  }
  let { uploadItem, maxRetries = 3, title, label, warning = false, entries = [] }: Props = $props();

  // Variables
  const { name, uploadedMedias, skippedMedias, errorMedias, isZip, status } = $derived(uploadItem);

  const running = $derived(status === "uploading" || status === "retrying");
  const statusLabel = $derived(status === "completed" && label ? label : getStatusLabel(uploadItem, maxRetries));
  const issues = $derived.by<string>(() => {
    const parts: string[] = [];
    if (skippedMedias.length > 0) parts.push(`${skippedMedias.length} skipped`);
    if (errorMedias.length > 0) parts.push(`${errorMedias.length} failed`);
    return parts.join(", ");
  });
  // Only a zip or a folder lists files (see upload-rows.ts); a single file's problem is its status line.
  const canExpand = $derived(status === "completed" && isZip && !!issues);

  let expanded = $state(false);

  // A single file's entry is its own name; a zip or folder lists its entries on demand.
  const MAX_LISTED_ENTRIES = 200;
  const listsEntries = $derived(status === "completed" && isZip && entries.length > 0);
  let entriesOpen = $state(false);
</script>

<div class="px-3 py-2">
  <div class="flex items-center gap-3">
    <div class="flex size-4 shrink-0 items-center justify-center">
      {#if running}
        <Spinner size="sm" class={status === "retrying" ? "text-amber-500" : "text-primary"} />
      {:else if warning}
        <img src="/assets/icons/WarningIcon.svg" alt="Warning" class="size-4 shrink-0" />
      {:else}
        <UploadItemStatusIcon
          {isZip}
          totalUploaded={uploadedMedias.length}
          totalSkipped={skippedMedias.length}
          totalErrors={errorMedias.length}
          {status}
        />
      {/if}
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium" title={title ?? name}>{title ?? name}</p>
      {#if listsEntries}
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex max-w-full cursor-pointer items-center gap-0.5 text-xs"
          aria-expanded={entriesOpen}
          onclick={() => (entriesOpen = !entriesOpen)}
        >
          <span class="truncate">{statusLabel}</span>
          {#if entriesOpen}
            <ChevronDownIcon class="size-3.5 shrink-0" />
          {:else}
            <ChevronRightIcon class="size-3.5 shrink-0" />
          {/if}
        </button>
      {:else}
        <p class="text-muted-foreground truncate text-xs" title={statusLabel}>{statusLabel}</p>
      {/if}
    </div>

    {#if canExpand}
      <button
        type="button"
        class="flex shrink-0 cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
        aria-expanded={expanded}
        onclick={() => (expanded = !expanded)}
      >
        {issues}
        {#if expanded}
          <ChevronDownIcon class="size-3.5" />
        {:else}
          <ChevronRightIcon class="size-3.5" />
        {/if}
      </button>
    {/if}
  </div>

  {#if listsEntries && entriesOpen}
    <ul class="mt-1.5 ml-7 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
      <!-- by position: entry names may repeat -->
      {#each entries.slice(0, MAX_LISTED_ENTRIES) as entry, index (index)}
        <li class="flex min-w-0 items-center gap-2 text-xs">
          <FileIcon class="text-muted-foreground size-3.5 shrink-0" />
          <span class="min-w-0 truncate" title={entry}>{entry}</span>
        </li>
      {/each}
      {#if entries.length > MAX_LISTED_ENTRIES}
        <li class="text-muted-foreground text-xs">
          and {entries.length - MAX_LISTED_ENTRIES} more {pluralizeUnit(
            entries.length - MAX_LISTED_ENTRIES,
            "entry",
            "entries",
          )}
        </li>
      {/if}
    </ul>
  {/if}

  {#if canExpand && expanded}
    <div class="mt-2 ml-7 flex flex-col gap-2">
      {#if skippedMedias.length > 0}
        <UploadItemCollapsibleSection
          label={`Skipped ${pluralizeUnit(skippedMedias.length, "file")}`}
          items={skippedMedias}
          variant="skipped"
        />
      {/if}
      {#if errorMedias.length > 0}
        <UploadItemCollapsibleSection
          label={`Failed ${pluralizeUnit(errorMedias.length, "file")}`}
          items={errorMedias}
          variant="error"
        />
      {/if}
    </div>
  {/if}
</div>
