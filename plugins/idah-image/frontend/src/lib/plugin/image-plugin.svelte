<script lang="ts">
  import "./plugin.css";

  import ImageAnnotationActivity from "$lib/plugin/image-annotation-activity/image-annotation-activity.svelte";

  import type { IActivityContext } from "$lib/context/context";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<div class="relative flex h-full w-full flex-col">
  <ImageAnnotationActivity {context} />
</div>
