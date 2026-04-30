<script lang="ts">
  import type { ContextMenuComponentProps } from "$lib/plugin/video-annotation-activity/context-menu/context-menu.store";

  // Props
  interface Props extends ContextMenuComponentProps {}
  let { ...props }: Props = $props();
</script>

<div>This is timeline context menu component</div>
