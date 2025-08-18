<script lang="ts">
	import type { VideoAnnotation } from "../VideoAnnotationContext";
	import TimelineCell from "./timeline-cell.svelte";

	let {
		annotation,
		currentFrame,
		range,
		timeline_zoom,
		hovered_column,
		hoveredColumnChange,
		onSeekFrame,
		onDeleteAnnotation,
		...restProps
	}: {
		annotation: VideoAnnotation;
		currentFrame: number;
		range: [number, number];
		timeline_zoom: number;
		hovered_column?: number;
		hoveredColumnChange: (column?: number) => void;
		onSeekFrame: (frame: number) => void;
		onDeleteAnnotation: (annotation: VideoAnnotation, frame: number) => void;
	} = $props();
</script>

<div class="" style:height="3em">
	{#each Array(Math.ceil((range[1] - range[0]) / timeline_zoom) + 1) as u, i}
		<TimelineCell
			frame={range[0] + i * timeline_zoom}
			{currentFrame}
			{range}
			{timeline_zoom}
			inSpan={Math.floor((annotation.shape.start - range[0]) / timeline_zoom) <= i &&
				Math.floor((annotation.shape.end - range[0]) / timeline_zoom) >= i}
			{onSeekFrame}
			keyframes={annotation.shape.frames
				.filter((s) => Math.floor((s.frame - range[0]) / timeline_zoom) == i)
				.map((s) => s.frame)}
			onDeleteFrame={(frame) => onDeleteAnnotation(annotation, frame)}
			hovered={hovered_column == range[0] + i * timeline_zoom}
			onmouseover={() => {
				hoveredColumnChange(range[0] + i * timeline_zoom);
			}}
			onmouseenter={() => {
				hoveredColumnChange(range[0] + i * timeline_zoom);
			}}
			onmouseleave={() => {
				hoveredColumnChange(undefined);
			}}
			{...restProps}
		/>
	{/each}
</div>
