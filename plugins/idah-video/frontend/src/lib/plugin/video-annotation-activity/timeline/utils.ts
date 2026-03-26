import { get } from "svelte/store";

import {
  TIMELINE_ROW_HEADER_WIDTH,
  timelineCellWidth as timelineCellWidthStore,
} from "$lib/plugin/video-annotation-activity/timeline/store";

export function getFrameFromMouseX(props: { clientX: number }) {
  const { clientX } = props;
  const timelineCellWidth = get(timelineCellWidthStore);
  return Math.ceil((clientX - TIMELINE_ROW_HEADER_WIDTH) / timelineCellWidth);
}

export function getSelectedFrameXFromCurrentFrame(props: { currentFrame: number }) {
  const { currentFrame } = props;
  const middleOfCurrentFrame = currentFrame - 0.5;

  const timelineCellWidth = get(timelineCellWidthStore);

  return Number(middleOfCurrentFrame * timelineCellWidth) + TIMELINE_ROW_HEADER_WIDTH;
}
