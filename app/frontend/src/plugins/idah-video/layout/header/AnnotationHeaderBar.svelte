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
    showCommentsSidebar: boolean;
    onSelectMode: (selectedMode: string) => void;
    onCommentsSidebarToggle: () => void;
  }
  let { context, mode, showCommentsSidebar, onSelectMode, onCommentsSidebarToggle }: Props = $props();
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
  <AnnotationHeaderBarActions {context} {showCommentsSidebar} {onCommentsSidebarToggle} />
</nav>
