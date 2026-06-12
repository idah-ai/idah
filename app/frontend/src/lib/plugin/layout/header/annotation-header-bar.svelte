<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import Separator from "@/components/ui/separator/separator.svelte";

  import type { WithElementRef } from "@/utils";

  import AnnotationHeaderBarActions from "./annotation-header-bar-actions.svelte";
  import AnnotationHeaderBarBackButton from "./annotation-header-bar-back-button.svelte";
  import AnnotationHeaderBarMediaName from "./annotation-header-bar-media-name.svelte";
  import AnnotationHeaderBarTools from "./annotation-header-bar-tools.svelte";
  import type { IdahDriverV2 } from "@/plugin/v2/driver";

  // Props
  interface Props {
    driver: IdahDriverV2;
    noteSidebarOpen?: boolean;
    onNoteToggle?: () => void;
  }
  let {
    ref = $bindable(null),
    driver,
    noteSidebarOpen = false,
    onNoteToggle,
  }: WithElementRef<HTMLAttributes<HTMLElement>> & Props = $props();
</script>

<nav bind:this={ref} id="annotation-header-bar" class="bg-sidebar grid grid-cols-3 border-b p-1">
  <!-- LEFT::NAVIGATIONS -->
  <div id="navigations" class="flex h-full items-center gap-2">
    <!-- BACK BUTTON -->
    <AnnotationHeaderBarBackButton {driver} />

    <Separator orientation="vertical" />
    <!-- MEDIA NAME -->
    <AnnotationHeaderBarMediaName name={driver.media.filename} />
  </div>

  <!-- CENTER::TOOLS -->
  <AnnotationHeaderBarTools {driver} />

  <!-- RIGHT::ACTIONS -->
  <AnnotationHeaderBarActions {driver} {noteSidebarOpen} {onNoteToggle} />
</nav>
