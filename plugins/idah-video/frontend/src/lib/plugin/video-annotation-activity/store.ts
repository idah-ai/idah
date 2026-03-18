import { writable } from "svelte/store";

import type {
  AnnotationGroup,
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "$idah/context/annotation-context";

type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

export const selectedAnnotation = writable<TAnnotationObj | undefined>(undefined);

export function deselectAnnotation() {
  selectedAnnotation.set(undefined);
}

export const selectedAnnotationGroup = writable<AnnotationGroup<TAnnotationObj> | undefined>(undefined);

export function deselectAnnotationGroup() {
  selectedAnnotationGroup.set(undefined);
}
