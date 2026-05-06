import { SvelteDate } from "svelte/reactivity";
import { writable } from "svelte/store";

import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";

export const idbUpdatedAt = writable<Date>(new SvelteDate());

export const boundingBoxes = writable<ImageAnnotationObject[]>([]);

export const entryRoot = writable<ImageAnnotationObject | undefined>();

export function setEntryRoot(annotation: ImageAnnotationObject | undefined) {
  entryRoot.set(annotation);
}

export function setIndexedDBUpdatedAt(date?: SvelteDate) {
  idbUpdatedAt.set(date || new SvelteDate());
}
