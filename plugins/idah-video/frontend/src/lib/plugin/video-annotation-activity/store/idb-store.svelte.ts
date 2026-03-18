import { SvelteDate } from "svelte/reactivity";
import { writable } from "svelte/store";

import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

export const idbUpdatedAt = writable<Date>(new SvelteDate());

export const boundingBoxes = writable<VideoAnnotationObject[]>([]);

export const entryRoot = writable<VideoAnnotationObject | undefined>();
