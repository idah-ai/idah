import { get } from "svelte/store";

import {
  framePerScale,
  TIMELINE_ROW_HEADER_WIDTH,
  timelineCellWidth as timelineCellWidthStore,
} from "$lib/plugin/video-annotation-activity/timeline/store";

export function getFrameFromMouseX(props: { clientX: number }) {
  const { clientX } = props;
  const timelineCellWidth = get(timelineCellWidthStore);
  const framePerScaleStore = get(framePerScale);
  const frameFloat = (clientX - TIMELINE_ROW_HEADER_WIDTH) / timelineCellWidth;

  if (framePerScaleStore <= 1) {
    return Math.ceil(frameFloat) * framePerScaleStore;
  }

  return Math.floor((frameFloat + 1) * framePerScaleStore);
}

export function getMouseXFromFrame(props: { frame: number }) {
  const { frame } = props;

  const timelineCellWidth = get(timelineCellWidthStore);
  const framePerScaleStore = get(framePerScale);

  let frameFloat: number;

  // if (framePerScaleStore <= 1) {
  // frameFloat = frame / framePerScaleStore;
  // } else {
  frameFloat = frame / framePerScaleStore - 1;
  // }

  const mouseX = Math.ceil(frameFloat * timelineCellWidth) + TIMELINE_ROW_HEADER_WIDTH;

  return Math.max(mouseX, TIMELINE_ROW_HEADER_WIDTH);
}

export function getSelectedFrameXFromCurrentFrame(props: { currentFrame: number }) {
  const { currentFrame } = props;
  const middleOfCurrentFrame = currentFrame - 0.5;

  const timelineCellWidth = get(timelineCellWidthStore);

  return Number(middleOfCurrentFrame * timelineCellWidth) + TIMELINE_ROW_HEADER_WIDTH;
}
