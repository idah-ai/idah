import type { Component } from "svelte";

export interface Viewport {
  startRange: number;
  endRange: number;
}

export interface TimelineItem<T extends Record<string, unknown> = Record<string, unknown>> {
  trackId: string;
  startRange: number;
  endRange: number;
  component: Component<T>;
}

export interface RulerProps {
  rulerSmallStep?: number;
  rulerBigStep?: number;
  rulerLabelFormatter?: (value: number) => string;
}

export interface TimelineProps extends RulerProps {
  viewport: Viewport;
  items: TimelineItem[];
  length: number;
}
