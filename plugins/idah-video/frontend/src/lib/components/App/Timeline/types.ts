import type { IAnnotationRecord, INoteRecord } from "$idah/v2/types";
import type { IVideoAnnotationRecord } from "$lib/types";
import type { Component, Snippet } from "svelte";

export interface Viewport {
  startRange: number;
  endRange: number;
}

export interface TimelineItem<T extends Record<string, unknown> = Record<string, unknown>> {
  trackId: string;
  startRange: number;
  endRange: number;
  rawData: any;
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

  /** Items to render in the pinned-notes row (always visible between ruler and tracks). */
  noteItems?: TimelineItem[];
  /** Label slot for the notes row's left spacer. */
  NoteTrackInfoSlot?: Snippet<[]>;
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
