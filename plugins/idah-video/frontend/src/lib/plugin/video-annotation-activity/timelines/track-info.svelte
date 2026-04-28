<script lang="ts">
  interface Props {
    trackId: string;
    top: number;
  }

  let { trackId, top }: Props = $props();
</script>

<div
  id={trackId}
  class="absolute left-0 right-0 px-2 border-b box-border border-r"
  style:top="{top}px"
  style:height="50px"
>
  <div class="flex flex-col h-full">
    <span>{trackId}</span>
    <span>...</span>
  </div>
</div>
