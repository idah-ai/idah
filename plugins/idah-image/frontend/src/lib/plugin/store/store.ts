import { writable } from "svelte/store";

import { DEFAULT_MODE } from "$lib/plugin/types";

import type { AnnotationGroup } from "$lib/context/annotation-context";
import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";

/** CURRENT MODE */
export const currentMode = writable<string>(DEFAULT_MODE);

export function setCurrentModeTo(mode: string) {
  currentMode.set(mode);
}

/** SELECTED ANNOTATION */
export const selectedAnnotation = writable<ImageAnnotationObject | undefined>(undefined);

export function setSelectedAnnotation(annotation: ImageAnnotationObject) {
  selectedAnnotation.set(annotation);
}

export function deselectAnnotation() {
  selectedAnnotation.set(undefined);
}

/** SELECTED ANNOTATION GROUP */
export const selectedAnnotationGroup = writable<AnnotationGroup<ImageAnnotationObject> | undefined>(undefined);

export function deselectAnnotationGroup() {
  selectedAnnotationGroup.set(undefined);
}
