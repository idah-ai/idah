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
