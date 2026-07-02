<script lang="ts">
  import { cn } from "@/utils";
  import { onDestroy, onMount } from "svelte";

  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { Checkbox } from "@/components/ui/checkbox";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import { Label } from "@/components/ui/label";

  import DataDisplay from "@/components/app/texts/data-display.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import EntryThumbnailPreview from "@/components/app/datasets/entries/cards/entry-thumbnail-preview.svelte";

  interface Props {
    entry: EntryRecord;
    modality: string;
    selected: boolean;
    onToggle: (id: string, checked: boolean) => void;
  }

  let { entry, modality, selected, onToggle }: Props = $props();

  let thumbnailUrl: string | null = $state(null);
  let thumbnailError = $state(false);

  // Entries whose media is still being processed can't be duplicated yet.
  let isProcessing = $derived(entry.status === "processing");

  function handleCheck(checked: boolean) {
    if (isProcessing) return;
    onToggle(entry.id, checked === true);
  }

  async function loadThumbnail(): Promise<void> {
    try {
      let key: string;
      switch (modality) {
        case "idah-video":
          key = "thumbnail.jpg";
          break;
        case "idah-image":
          key = "thumbnail.webp";
          break;
        default:
          key = "processed.webp"; // default fallback image for thumbnail
      }

      thumbnailUrl = await mediaBackendDataSource.getFiles({
        resource: entry.resource,
        key,
      });
      thumbnailError = false;
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      thumbnailError = true;
      thumbnailUrl = null;
    }
  }

  function cleanup() {
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
    }
  }

  onMount(() => {
    loadThumbnail();
  });

  onDestroy(cleanup);
</script>

<div
  class={cn(
    "flex flex-col gap-2 rounded-md border p-3 transition-colors",
    isProcessing
      ? "cursor-not-allowed border-transparent opacity-50"
      : selected
        ? "bg-primary/5 border-primary/20"
        : "hover:bg-muted/50 border-transparent",
  )}
>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <Checkbox
        id={"select-" + entry.id}
        checked={selected && !isProcessing}
        disabled={isProcessing}
        onCheckedChange={handleCheck}
      />

      <div class="flex-1 overflow-hidden">
        <EntryThumbnailPreview {thumbnailUrl} {thumbnailError} {modality} />
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-1">
      <Label
        for={"select-" + entry.id}
        class="cursor-pointer truncate text-sm font-medium"
        title={entry.name || entry.id}
      >
        {entry.name || entry.id}
      </Label>
      <div class="text-muted-foreground flex items-center gap-1 text-xs">
        {#if isProcessing}
          <span>Still processing — can't be duplicated yet</span>
        {:else}
          <DataDisplay label="Created at">
            {#snippet slotValue()}
              <DateText datetime={entry.created_at} datetimeFormat="MMM dd, yyyy" size="xs" weight="light" />
            {/snippet}
          </DataDisplay>
        {/if}
      </div>
    </div>
  </div>
</div>
