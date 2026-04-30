<script lang="ts">
  import { selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import { TRACK_HEIGHT } from "$lib/plugin/video-annotation-activity/timelines/constants";
  import { cn } from "$lib/utils";

  import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
  import type { TrackData } from "$lib/plugin/video-annotation-activity/timelines/types";

  // Props
  interface Props {
    track: TrackData;
    onClick: (annotation?: VideoAnnotationObject) => void;
  }

  let { track, onClick }: Props = $props();

  // Variables
  let { id, title, subtitle, top, items } = $derived(track);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId === id);

  // Functions
  function handleClick() {
    /**
     * Select annotation group
     * 1. If there is no selectedCurrentFrame, select the first frame of the annotation group
     * 2. If there is selectedCurrentFrame, select the closest annotation to the selectedCurrentFrame
     */
    onClick(items[0].rawData);
  }
</script>

<button
  class={cn(
    "hover:bg-secondary absolute right-0 left-0 box-border cursor-pointer border-b px-2 text-left focus:outline-none",
    {
      "border-primary bg-primary/10 border-t border-b": isGroupSelected,
    },
  )}
  style:top="{top}px;"
  style:height="{TRACK_HEIGHT}px;"
  onclick={handleClick}
>
  <div class="flex flex-col">
    <!-- SUBTITLE::CATEGORY -->
    <span id="subtitle" class="text-muted-foreground text-xs">
      {subtitle}
    </span>

    <!-- TITLE::CATEGORY WITH GROUP ID -->
    <span
      id="title"
      class={cn("font-regular truncate text-xs", {
        "text-primary font-bold": isGroupSelected,
      })}
    >
      {title}
    </span>
  </div>
</button>
