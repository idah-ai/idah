<!-- TODO: May be this is not use -->
<script lang="ts">
  // Props
  interface Props {
    timelineCellWidth: number;
    frameIndex: number;
  }
  let { timelineCellWidth, frameIndex }: Props = $props();

  // Functions
  function onClickFrame() {
    console.log({ frameIndex });
  }
</script>

<div
  id="timeline-cell"
  class="hover:bg-primary/50 absolute flex h-9 items-center justify-center"
  style:width="{timelineCellWidth}px"
  style:top="-18px"
  style:left="{frameIndex * timelineCellWidth}px"
  onclick={onClickFrame}
>
  x
</div>
