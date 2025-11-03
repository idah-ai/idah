<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import Separator from "@/components/ui/separator/separator.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { WithElementRef } from "@/utils";

  import AnnotationHeaderBarActions from "./AnnotationHeaderBarActions.svelte";
  import AnnotationHeaderBarBackButton from "./AnnotationHeaderBarBackButton.svelte";
  import AnnotationHeaderBarMediaName from "./AnnotationHeaderBarMediaName.svelte";
  import AnnotationHeaderBarTools from "./AnnotationHeaderBarTools.svelte";

  // Props
  interface Props {
    context: IActivityContext;
    pluginContainerElement: HTMLElement | null;
  }
  let {
    ref = $bindable(null),
    context,
    pluginContainerElement,
  }: WithElementRef<HTMLAttributes<HTMLElement>> & Props = $props();
</script>

<nav bind:this={ref} id="annotation-header-bar" class="grid grid-cols-3 p-2">
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
  <AnnotationHeaderBarActions {context} {pluginContainerElement} />
</nav>
