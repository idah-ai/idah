<script lang="ts">
	import AnnotationHeaderBarActions from "@/components/app/annotation/layout/AnnotationHeaderBarActions.svelte";
	import AnnotationHeaderBarBackButton from "@/components/app/annotation/layout/AnnotationHeaderBarBackButton.svelte";
	import AnnotationHeaderBarMediaName from "@/components/app/annotation/layout/AnnotationHeaderBarMediaName.svelte";
	import AnnotationHeaderBarTools from "@/components/app/annotation/layout/AnnotationHeaderBarTools.svelte";
	import Separator from "@/components/ui/separator/separator.svelte";

	import type { ActivityContext } from "@/context/ActivityContext";
	import type { VideoMode } from "@/components/video-annotation-activity/VideoAnnotationContext";

	// Props
	interface Props {
		context: ActivityContext;
		mode: VideoMode;
		onSelectMode: (selectedMode: VideoMode) => void;
	}
	let { context, mode = $bindable(), onSelectMode }: Props = $props();
</script>

<nav id="annotation-header-bar" class="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
	<!-- LEFT::NAVIGATIONS -->
	<div id="navigations" class="flex h-full items-center gap-2">
		<!-- BACK BUTTON -->
		<AnnotationHeaderBarBackButton />

		<Separator orientation="vertical" />

		<!-- MEDIA NAME -->
		<AnnotationHeaderBarMediaName name={context.medias["main"].url} />
	</div>

	<!-- CENTER::TOOLS -->
	<AnnotationHeaderBarTools {onSelectMode} bind:mode />

	<!-- RIGHT::ACTIONS -->
	<AnnotationHeaderBarActions />
</nav>
