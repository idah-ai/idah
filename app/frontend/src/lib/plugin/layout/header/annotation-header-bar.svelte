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

<nav bind:this={ref} id="annotation-header-bar" class="grid grid-cols-4 p-1">
  <!-- LEFT::NAVIGATIONS -->
  <div id="navigations" class="col-span-2 flex h-full items-center gap-2">
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
