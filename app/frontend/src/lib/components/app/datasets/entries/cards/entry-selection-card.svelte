<script lang="ts">
  import { cn } from "@/utils";
  import { onDestroy, onMount } from "svelte";

  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { AspectRatio } from "@/components/ui/aspect-ratio"
  import { Checkbox } from "@/components/ui/checkbox";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import { Label } from "@/components/ui/label";

  import DataDisplay from "@/components/app/texts/data-display.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";

  interface Props {
    entry: EntryRecord;
    selected: boolean;
    onToggle: (id: string, checked: boolean) => void;
  }

  let { entry, selected, onToggle }: Props = $props();

  // thumbnail state - following entry-card.svelte
  let thumbnailImg: HTMLImageElement = $state(new Image());
  let thumbnailUrl: string | null = $state(null);
  let thumbnailError = $state(false);
  let currentImagePosition = $state(0);
  let animationInterval: number | null = $state(null);

  const TOTAL_POSITIONS = 10; // 10 images inside the larger image
  const ANIMATION_INTERVAL_MS = 350; // same timing as entry-card

  function handleCheck(checked: boolean) {
    onToggle(entry.id, checked === true);
  }

  async function loadThumbnail(): Promise<void> {
    try {
      thumbnailUrl = await mediaBackendDataSource.getFiles({
        resource: entry.resource,
        key: "thumbnail.jpg",
      });

      thumbnailImg.onload = () => {};

      thumbnailImg.src = thumbnailUrl;
      thumbnailError = false;
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      thumbnailError = true;
      thumbnailUrl = null;
    }
  }

  // TODO: should be able to refactor as preview functionality ?
  // animation functions - following entry-card
  function startAnimation() {
    if (animationInterval) return;

    animationInterval = setInterval(() => {
      currentImagePosition = (currentImagePosition + 1) % TOTAL_POSITIONS;
    }, ANIMATION_INTERVAL_MS);
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }

    currentImagePosition = 0; // reset to first image
  }

  function cleanup() {
    stopAnimation();
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
    selected ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50 border-transparent",
  )}
>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <Checkbox id={"select-" + entry.id} checked={selected} onCheckedChange={handleCheck} />

      <div class="flex-1 overflow-hidden">
        <AspectRatio ratio={16 / 9} class="bg-muted w-full rounded-lg">
          {#if thumbnailUrl}
            <div
              role="img"
              class="relative h-full w-full overflow-hidden rounded-lg"
              onmouseenter={startAnimation}
              onmouseleave={stopAnimation}
            >
              <img
                src={thumbnailUrl}
                alt="Entry thumbnail"
                class="absolute top-0 left-0 h-full cursor-pointer object-cover"
                style:width="{TOTAL_POSITIONS * 100}%"
                style:max-width="none"
                style:transform="translateX(-{currentImagePosition * (100 / TOTAL_POSITIONS)}%)"
              />
            </div>
          {:else if thumbnailError}
            <div class="text-muted-foreground flex h-full items-center justify-center text-xs">No thumbnail</div>
          {:else}
            <div class="flex h-full items-center justify-center">
              <div class="bg-muted/50 h-full w-full animate-pulse rounded-lg"></div>
            </div>
          {/if}
        </AspectRatio>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-1">
      <Label for={"select-" + entry.id} class="cursor-pointer truncate text-sm font-medium" title={entry.resource}>
        {entry.resource}
      </Label>
      <div class="text-muted-foreground flex items-center gap-1 text-xs">
        <DataDisplay label="Created at">
          {#snippet slotValue()}
            <DateText datetime={entry.created_at} datetimeFormat="MMM dd, yyyy" size="xs" weight="light" />
          {/snippet}
        </DataDisplay>
      </div>
    </div>
  </div>
</div>
