<script lang="ts">
  import VideoAnnotationActivity from "./video-annotation-activity.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<VideoAnnotationActivity {context}></VideoAnnotationActivity>
