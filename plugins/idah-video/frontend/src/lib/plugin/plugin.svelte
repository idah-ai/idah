<script lang="ts">
  import "./plugin.css";
  import VideoAnnotationActivity from "./video-annotation-activity.svelte";

  import type { IActivityContext } from "$idah/context/ActivityContext";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<VideoAnnotationActivity {context} />
