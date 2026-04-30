<script lang="ts">
  interface Props {
    title?: string;
    color?: string;
  }

  let { title = "Block", color = "#4a90d9" }: Props = $props();
</script>

<div class="block" style="background-color: {color};">
  {title}
</div>

<style>
  .block {
    width: 100%;
    height: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    color: white;
    font-size: 0.875rem;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
