<script lang="ts">
  import type { TrackData } from "$lib/plugin/video-annotation-activity/timeline/types";

  // Props
  interface Props {
    track: TrackData;
  }

  let { track }: Props = $props();

  // Variables
  const { id, top } = $derived(track);
</script>

<div class="track-info" style="top: {top}px;">
  {id}
</div>

<style>
  .track-info {
    position: absolute;
    left: 0;
    right: 0;
    height: 50px;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
    box-sizing: border-box;
  }
</style>
