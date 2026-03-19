<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import { Checkbox } from "@/components/ui/checkbox";
  import { Label } from "@/components/ui/label";
  import { AspectRatio } from "@/components/ui/aspect-ratio";
  import EntryStatusBadge from "@/components/app/datasets/entries/badges/entry-status.svelte";
  import EntryPriorityBadge from "@/components/app/datasets/entries/badges/entry-priority.svelte";
  import DateText from "@/components/app/texts/date-text.svelte";
  import { mediaBackendDataSource } from "@/data/model/media/medias/medias-record";
  import { humanize } from "@/utils/string";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import { cn } from "@/utils";

  interface Props {
    entry: EntryRecord;
    selected: boolean;
    onToggle: (id: string, checked: boolean) => void;
  }

  let { entry, selected, onToggle }: Props = $props();

  // thumbnail state - following entry-card.svelte
  let imgContainer: HTMLDivElement | undefined = $state(undefined);
  let containerWidth: number = $state(84); // compact thumbnail width with max constraint
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

      thumbnailImg.onload = () => {
        const width = thumbnailImg.width;
        const calculatedWidth = width / TOTAL_POSITIONS;
        // set max width of 84 for compact cards while preserving sprite functionality
        containerWidth = Math.min(calculatedWidth, 84);
      };

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
    "flex items-center gap-4 rounded-md border p-3 transition-colors",
    selected ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50 border-transparent",
  )}
>
  <Checkbox id={"select-" + entry.id} checked={selected} onCheckedChange={handleCheck} />

  <!-- THUMBNAIL -->
  <div class="flex shrink-0 items-center">
    <div class="h-12 overflow-hidden" style:width="{containerWidth}px" style:max-width="{containerWidth}px">
      <AspectRatio ratio={16 / 9} class="bg-muted h-full rounded-lg">
        {#if thumbnailUrl}
          <div
            bind:this={imgContainer}
            role="img"
            class="relative h-full w-full overflow-hidden rounded-lg"
            onmouseenter={startAnimation}
            onmouseleave={stopAnimation}
          >
            <img
              src={thumbnailUrl}
              alt="Entry thumbnail"
              class="absolute top-0 left-0 cursor-pointer object-cover"
              style:height="{imgContainer?.clientHeight}px"
              style:width="{containerWidth * TOTAL_POSITIONS}px"
              style:max-width="none"
              style:transform="translateX(-{currentImagePosition * containerWidth || 0}px)"
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

  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <Label for={"select-" + entry.id} class="cursor-pointer truncate text-sm font-medium" title={entry.resource}>
        {entry.resource}
      </Label>
      <div class="text-muted-foreground flex items-center gap-1 text-xs">
        <span>Created At:</span>
        <DateText datetime={entry.created_at} datetimeFormat="MMM dd, yyyy" size="xs" weight="light" />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <EntryStatusBadge {entry} />
      <EntryPriorityBadge {entry} />
      <div class="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:block">
        {humanize(entry.wf_step)}
      </div>
    </div>
  </div>
</div>
