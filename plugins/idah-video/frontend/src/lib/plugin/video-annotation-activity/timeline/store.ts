import { get, writable } from "svelte/store";

export const TIMELINE_ROW_HEADER_WIDTH: number = 320; // Unit: px

/** The width of each timeline cell in px */
export const timelineCellWidth = writable<number>(20);

export function setTimelineCellWidth(width: number) {
  timelineCellWidth.set(width);
}

/** SELECTED FRAME X */
export const selectedFrameX = writable<number>(0);

export function setSelectedFrameX(frameX: number) {
  selectedFrameX.set(frameX);
}

export function selectFirstFrameX() {
  const cellWidth = get(timelineCellWidth);
  selectedFrameX.set(TIMELINE_ROW_HEADER_WIDTH + Number(cellWidth / 2));
}

export function deselectFrameX() {
  selectedFrameX.set(0);
}
