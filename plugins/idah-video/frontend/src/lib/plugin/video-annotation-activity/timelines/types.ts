import type { Component } from 'svelte';

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

export interface TimelineRulerProps {
	viewport: Viewport;
	rulerMinorStep?: number;
	rulerMajorStep?: number;
	rulerLabelFormatter?: (value: number) => string;
}

export interface TimelineProps extends TimelineRulerProps {
	items: TimelineItem[];
	totalFrames: number;
}
