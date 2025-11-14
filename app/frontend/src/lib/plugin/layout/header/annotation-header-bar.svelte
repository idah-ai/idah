<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import Separator from "@/components/ui/separator/separator.svelte";

  import type { IActivityContext } from "@/plugin/interface/Activity";
  import type { WithElementRef } from "@/utils";

  import AnnotationHeaderBarActions from "./annotation-header-bar-actions.svelte";
  import AnnotationHeaderBarBackButton from "./annotation-header-bar-back-button.svelte";
  import AnnotationHeaderBarMediaName from "./annotation-header-bar-media-name.svelte";
  import AnnotationHeaderBarTools from "./annotation-header-bar-tools.svelte";

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

<nav bind:this={ref} id="annotation-header-bar" class="grid grid-cols-3 p-2 items-center gap-2">
  <!-- LEFT::NAVIGATIONS -->
  <div id="navigations" class="flex items-center gap-1">
    <AnnotationHeaderBarBackButton {context} />
    <Separator orientation="vertical" />
    <!-- MEDIA NAME -->
    <AnnotationHeaderBarMediaName name={context.mediaUrl} />
  </div>

  <!-- CENTER::TOOLS -->
  <div class="flex justify-center">
    <AnnotationHeaderBarTools {context} />
  </div>

  <!-- RIGHT::ACTIONS -->
  <div class="flex justify-end">
    <AnnotationHeaderBarActions {context} {pluginContainerElement} />
  </div>
</nav>