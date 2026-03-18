import { writable } from "svelte/store";

import type { AnnotationGroup } from "$idah/context/annotation-context";
import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

/** SELECTED ANNOTATION */
export const selectedAnnotation = writable<VideoAnnotationObject | undefined>(undefined);

export function setSelectedAnnotation(annotation: VideoAnnotationObject) {
  selectedAnnotation.set(annotation);
}

export function deselectAnnotation() {
  selectedAnnotation.set(undefined);
}

/** SELECTED ANNOTATION GROUP */
export const selectedAnnotationGroup = writable<AnnotationGroup<VideoAnnotationObject> | undefined>(undefined);

export function deselectAnnotationGroup() {
  selectedAnnotationGroup.set(undefined);
}
