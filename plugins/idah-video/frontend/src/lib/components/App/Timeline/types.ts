import type { IVideoAnnotationRecord } from "$lib/types";
import type { Component, Snippet } from "svelte";

export interface Viewport {
  startRange: number;
  endRange: number;
  /** Internal — set by Timeline.svelte to expose its clamp+sync logic
   *  to external callers such as the timeline.focus command. */
  _focusHandler?: ((start: number, end: number) => void) | null;
}

export interface TimelineItem<T extends Record<string, unknown> = Record<string, unknown>> {
  trackId: string;
  startRange: number;
  endRange: number;
  rawData: IVideoAnnotationRecord;
  component: Component<{ item: TimelineItem<T> }>;
}

export interface RulerProps {
  rulerSmallStep?: number;
  rulerBigStep?: number;
  rulerLabelFormatter?: (value: number) => string;
}

export interface TimelineProps extends RulerProps {
  viewport: Viewport;
  items: TrackData[];
  length: number;

  TrackInfoHeaderSlot?: Snippet<[]>;
  TrackInfoSlot?: Snippet<[{ track: TrackData }]>;
}

/**
 * Track data structure for rendering grouped annotations
 */
export interface TrackData {
  id: string;
  title: string;
  subtitle?: string;
  top: number;
  items: TimelineItem[];
}
