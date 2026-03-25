<script lang="ts">
  import "./plugin.css";

  import VideoAnnotationActivity from "$lib/plugin/video-annotation-activity/video-annotation-activity.svelte";

  import type { IActivityContext } from "$idah/context/activity-context";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<VideoAnnotationActivity {context} />
