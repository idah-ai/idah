import { get } from "svelte/store";

import { currentFrame } from "$lib/plugin/video-annotation-activity/store/store";
import {
  currentFrameRange,
  framePerScale,
  setCurrentFrameRange,
  setSelectedFrameX,
  TIMELINE_ROW_HEADER_WIDTH,
  timelineCellWidth,
  timelineRulerWidth
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
  const timelineCellWidthStore = get(timelineCellWidth);
  const framePerScaleStore = get(framePerScale);
  const frameFloat = (clientX - TIMELINE_ROW_HEADER_WIDTH) / timelineCellWidthStore;

  return Math.ceil(frameFloat * framePerScaleStore);
}

export function getMouseXFromFrame(props: { frame: number }) {
  const { frame } = props;

  const timelineCellWidthStore = get(timelineCellWidth);
  const framePerScaleStore = get(framePerScale);
  const [startFrameIndexOfCurrentFrameRange] = get(currentFrameRange);

  const shiftedFrame = (frame - Number((startFrameIndexOfCurrentFrameRange - 1) * framePerScaleStore)) / framePerScaleStore;
  const actualMouseX = (shiftedFrame * timelineCellWidthStore) + TIMELINE_ROW_HEADER_WIDTH;
  const displayMouseX = Math.floor(actualMouseX - timelineCellWidthStore);

  return Math.max(displayMouseX, TIMELINE_ROW_HEADER_WIDTH);
}

export function getSelectedFrameXFromCurrentFrame(props: { currentFrame: number }) {
  const { currentFrame } = props;
  const timelineCellWidthStore = get(timelineCellWidth);
  const framePerScaleStore = get(framePerScale);
  const startOfCurrentFrameRange = get(currentFrameRange)[0];

  const normalizedCurrentFrame = currentFrame / framePerScaleStore;
  const normalizedFrameInScale = normalizedCurrentFrame - startOfCurrentFrameRange;
  const middleOfnormalizedFrameInScale = normalizedFrameInScale - Number(0.5 / framePerScaleStore);

  return Number(middleOfnormalizedFrameInScale * timelineCellWidthStore) + TIMELINE_ROW_HEADER_WIDTH;
}

export function paginateCurrentFrameRange(props: { frameStep: number }) {
  /**
   * NOTE:
   * frameStep is positive when you want to shift current frame range to the right
   * frameStep is negative when you want to shift current frame range to the left
   */
  const { frameStep } = props;

  /** Need to check shift left / right, otherwise the currentFrameSpan will start at negative */
  const shiftRight = frameStep > 0;
  const shiftLeft = frameStep < 0;

  const currentFrameBeforePress = get(currentFrame);
  const currentFrameAfterPress = currentFrameBeforePress + frameStep;
  const currentFrameRangeStore = get(currentFrameRange);
  const [startFrameIndexOfCurrentFrameRange, endFrameIndexOfCurrentFrameRange] = currentFrameRangeStore;

  const timelineRulerWidthStore = get(timelineRulerWidth);
  const tinmelineCellWidthStore = get(timelineCellWidth);
  const rulerScale = timelineRulerWidthStore / tinmelineCellWidthStore;

  if (currentFrameAfterPress > endFrameIndexOfCurrentFrameRange && shiftRight) {
    const newStart = startFrameIndexOfCurrentFrameRange + frameStep;
    const newEnd = endFrameIndexOfCurrentFrameRange + frameStep;
    setCurrentFrameRange([newStart, newEnd]);
  }

  if (currentFrameAfterPress <= startFrameIndexOfCurrentFrameRange && shiftLeft) {
    const newStart = Math.max(startFrameIndexOfCurrentFrameRange + frameStep, 0);
    const newEnd = Math.max(endFrameIndexOfCurrentFrameRange + frameStep, rulerScale);

    setCurrentFrameRange([newStart, newEnd]);
  }
}

export function recalculateSelectedFrameXFromCurrentFrame() {
  const currentFrameStore = get(currentFrame);
  const nexSelectedFrameX = getMouseXFromFrame({ frame: currentFrameStore});
  setSelectedFrameX(nexSelectedFrameX);
}
  