import { SvelteDate } from "svelte/reactivity";
import { writable } from "svelte/store";

import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

export const idbUpdatedAt = writable<Date>(new SvelteDate());

export const boundingBoxes = writable<VideoAnnotationObject[]>([]);

export const entryRoot = writable<VideoAnnotationObject | undefined>();

export function setEntryRoot(annotation: VideoAnnotationObject | undefined) {
  entryRoot.set(annotation);
}

export function setIndexedDBUpdatedAt(date?: SvelteDate) {
  idbUpdatedAt.set(date || new SvelteDate());
}
