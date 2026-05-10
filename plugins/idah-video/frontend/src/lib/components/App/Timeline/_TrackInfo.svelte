<script lang="ts">
  import type { TrackData } from "$lib/components/App/Timeline/types";
  import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";

  // Props
  interface Props {
    track: TrackData;
  }

  let { track }: Props = $props();

  // Variables
  const { id } = $derived(track);
</script>

<div class="track-info" style="height: {TRACK_HEIGHT}px;">
  {id}
</div>

<style>
  .track-info {
    width: 100%;
    border-bottom: 1px solid #eee;
    box-sizing: border-box;
  }
</style>
