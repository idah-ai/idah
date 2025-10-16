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
    mode: string;
    onSelectMode: (selectedMode: string) => void;
  }
  let { context, mode, onSelectMode }: Props = $props();
</script>

<nav id="annotation-header-bar" class="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
  <!-- LEFT::NAVIGATIONS -->
  <div id="navigations" class="flex h-full flex-1 items-center gap-2">
    <!-- BACK BUTTON -->
    <AnnotationHeaderBarBackButton {context} />

    <Separator orientation="vertical" />

    <!-- MEDIA NAME -->
    <AnnotationHeaderBarMediaName name={context.mediaUrl} />
  </div>

  <!-- CENTER::TOOLS -->
  <AnnotationHeaderBarTools {mode} {onSelectMode} />

  <!-- RIGHT::ACTIONS -->
  <AnnotationHeaderBarActions />
</nav>
