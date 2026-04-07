import { get } from "svelte/store";

import {
  currentFrameRange,
  framePerScale,
  TIMELINE_ROW_HEADER_WIDTH,
  timelineCellWidth as timelineCellWidthStore,
} from "$lib/plugin/video-annotation-activity/timeline/store";

import type { AnnotationGroup } from "$idah/context/annotation-context";
import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

export function getAnnotationGroupFrameRanges(props: {
  annotationGroup: AnnotationGroup<VideoAnnotationObject> | undefined;
}): Array<number[]> {
  const { annotationGroup } = props;

  if (!annotationGroup) return [];

  return annotationGroup.annotations.map((ann) =>
    (ann.shape.frames as { frame: number }[]).map((frame) => frame.frame).sort((a, b) => a - b),
  );
}

export function getFrameFromMouseX(props: { clientX: number }) {
  const { clientX } = props;
  const timelineCellWidth = get(timelineCellWidthStore);
  const framePerScaleStore = get(framePerScale);
  const frameFloat = (clientX - TIMELINE_ROW_HEADER_WIDTH) / timelineCellWidth;

  return Math.ceil(frameFloat * framePerScaleStore);
}

export function getMouseXFromFrame(props: { frame: number }) {
  const { frame } = props;

  const timelineCellWidth = get(timelineCellWidthStore);
  const framePerScaleStore = get(framePerScale);
  const startOfCurrentFrameRange = get(currentFrameRange)[0];
  const frameFloat = (frame - startOfCurrentFrameRange) / framePerScaleStore;

  const actualMouseX = Math.ceil(frameFloat * timelineCellWidth) + TIMELINE_ROW_HEADER_WIDTH;
  const displayMouseX = Number(actualMouseX - timelineCellWidth) + 1;

  return Math.max(displayMouseX, TIMELINE_ROW_HEADER_WIDTH);
}

export function getSelectedFrameXFromCurrentFrame(props: { currentFrame: number }) {
  const { currentFrame } = props;
  const timelineCellWidth = get(timelineCellWidthStore);
  const framePerScaleStore = get(framePerScale);
  const startOfCurrentFrameRange = get(currentFrameRange)[0];

  const normalizedCurrentFrame = currentFrame / framePerScaleStore;
  const normalizedStartOfCurrentFrameRange = startOfCurrentFrameRange / framePerScaleStore;

  const normalizedFrameInScale = normalizedCurrentFrame - normalizedStartOfCurrentFrameRange;
  const middleOfnormalizedFrameInScale = normalizedFrameInScale - Number(0.5 / framePerScaleStore);

  return Number(middleOfnormalizedFrameInScale * timelineCellWidth) + TIMELINE_ROW_HEADER_WIDTH;
}
