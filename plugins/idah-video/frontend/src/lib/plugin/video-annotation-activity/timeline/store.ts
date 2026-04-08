import { totalFrames } from "$lib/plugin/video-annotation-activity/store/store";
import { get, writable } from "svelte/store";

export const TIMELINE_ROW_HEADER_WIDTH: number = 300; // Unit: px
export const TIMELINE_CELL_MIN_WIDTH: number = 10; // Unit: px
export const TIMELINE_CELL_MAX_WIDTH: number = 40; // Unit: px
export const TIMELINE_CELL_WIDTH_STEP: number = 1; // Unit: px

/**
 * TIMELINE::CELL WIDTH
 * The width of each timeline cell in px
 * Default: (max + min) / 2, will be the center of slider
 */
export const timelineCellWidth = writable<number>(Math.floor((TIMELINE_CELL_MAX_WIDTH + TIMELINE_CELL_MIN_WIDTH) / 2));

export function setTimelineCellWidth(newWidth: number) {
  timelineCellWidth.set(newWidth);
}

/**
 * TIMELINE::RULER WIDTH
 * The width of each timeline cell in px
 */
export const timelineRulerWidth = writable<number>(0);

/** TIMELINE::OFFSET */
export const timelineOffset = writable<number>(5);

export function setTimelineOffset(newOffset: number) {
  timelineOffset.set(newOffset);
}

/**
 * TIMELINE::FRAME RANGE
 * The range of frames to display in the timeline
 * Calculated based on the timeline cell width and the timeline ruler width
 */
export const currentFrameRange = writable<[number, number]>([0, 1]);

export function setCurrentFrameRange(newRange: [number, number]) {
  currentFrameRange.set(newRange);
}

export function getCurrentFrameRangeSpan() {
  const [startFrame, endFrame] = get(currentFrameRange);
  return endFrame - startFrame;
}

export function getFrameRange(startFrame: number, endFrame: number) {
  return Array.from({ length: endFrame - startFrame }, (_, i) => startFrame + i);
}

export function recalculateFrameRange() {}

/**
 * TIMELINE::FRAME PER SCALE
 * The number of frames per scale
 * Calculated based on the timeline cell width and the timeline ruler width
 */
export const framePerScale = writable<number>(1);

export function setFramePerScale(newFramePerScale: number) {
  framePerScale.set(newFramePerScale);
}

export function recalculateFramePerScale() {
  const rulerWidth = get(timelineRulerWidth);
  const cellWidth = get(timelineCellWidth);
  const totalFrame = get(totalFrames);

  const rulerScale = Math.floor(rulerWidth / cellWidth);

  let newFramePerScale: number;
  if (cellWidth >= rulerScale) {
    newFramePerScale = 1;
  } else if (Math.floor(totalFrame / rulerScale) < Math.floor(rulerScale / cellWidth)) {
    newFramePerScale = Math.ceil(totalFrame / rulerScale);
  } else {
    newFramePerScale = Math.floor(rulerScale / cellWidth);
  }

  setFramePerScale(newFramePerScale);
}

/** SELECTED FRAME X */
export const selectedFrameX = writable<number>(0);

export function setSelectedFrameX(newFrameX: number) {
  selectedFrameX.set(newFrameX);
}

export function selectFirstFrameX() {
  const cellWidth = get(timelineCellWidth);
  const framePerScaleStore = get(framePerScale);
  const scaledCellWidth = cellWidth / framePerScaleStore;
  const centerOfFirstFrame = scaledCellWidth / 2;
  setSelectedFrameX(TIMELINE_ROW_HEADER_WIDTH + centerOfFirstFrame);
}

export function deselectFrameX() {
  selectedFrameX.set(0);
}
