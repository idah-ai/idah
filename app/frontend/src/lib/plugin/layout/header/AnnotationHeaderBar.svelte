<script lang="ts">
  import Separator from "@/components/ui/separator/separator.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";

  import AnnotationHeaderBarActions from "./AnnotationHeaderBarActions.svelte";
  import AnnotationHeaderBarBackButton from "./AnnotationHeaderBarBackButton.svelte";
  import AnnotationHeaderBarMediaName from "./AnnotationHeaderBarMediaName.svelte";
  import AnnotationHeaderBarTools from "./AnnotationHeaderBarTools.svelte";

  // Props
  interface Props {
    context: IActivityContext;
  }
  let { context }: Props = $props();
</script>

<nav id="annotation-header-bar" class="grid grid-cols-3 p-2">
  <!-- LEFT::NAVIGATIONS -->
  <div id="navigations" class="flex h-full items-center gap-2">
    <!-- BACK BUTTON -->
    <AnnotationHeaderBarBackButton {context} />

    <Separator orientation="vertical" />

    <!-- MEDIA NAME -->
    <AnnotationHeaderBarMediaName name={context.mediaUrl} />
  </div>

  <!-- CENTER::TOOLS -->
  <AnnotationHeaderBarTools {context} />

  <!-- RIGHT::ACTIONS -->
  <AnnotationHeaderBarActions />
</nav>
