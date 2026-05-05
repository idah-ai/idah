import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
import type { Component, Snippet } from "svelte";

export interface Viewport {
  startRange: number;
  endRange: number;
}

export interface TimelineItem<T extends Record<string, unknown> = Record<string, unknown>> {
  trackId: string;
  startRange: number;
  endRange: number;
  rawData: VideoAnnotationObject;
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
