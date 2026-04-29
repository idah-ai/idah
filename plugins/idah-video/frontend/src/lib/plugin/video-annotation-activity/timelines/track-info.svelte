<script lang="ts">
  interface Props {
    trackId: string;
    top: number;
  }

  let { trackId, top }: Props = $props();
</script>

<div class="track-info" style="top: {top}px;">
  {trackId}
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
