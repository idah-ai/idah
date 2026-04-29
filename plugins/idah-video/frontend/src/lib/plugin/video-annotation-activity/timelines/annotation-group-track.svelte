<script lang="ts">
  import { selectedAnnotationGroup } from "$lib/plugin/video-annotation-activity/store/store";
  import { TRACK_HEIGHT } from "$lib/plugin/video-annotation-activity/timelines/constants";
  import { cn } from "$lib/utils";

  import type { AnnotationGroup } from "$idah/context/annotation-context";
  import type { TrackData } from "$lib/plugin/video-annotation-activity/timelines/types";
  import type { VideoAnnotationObject } from "../context/video-annotation-context";

  // Props
  interface Props {
    track: TrackData;
    onSelectAnnotationGroup: (annotationGroup: AnnotationGroup<VideoAnnotationObject>, selectedFrame?: number) => void;
  }

  let { track, onSelectAnnotationGroup }: Props = $props();

  // Variables
  let { id, title, subtitle, top } = $derived(track);
  let isGroupSelected = $derived($selectedAnnotationGroup?.groupId === id);

  // Functions
  function handleClickTrackInfo() {
    const thisAnnotationGroup: AnnotationGroup<VideoAnnotationObject> = {
      groupId: id,
      annotations: track.items.map((item) => item.rawData),
    };
    onSelectAnnotationGroup(thisAnnotationGroup, undefined);
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
  onclick={handleClickTrackInfo}
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
