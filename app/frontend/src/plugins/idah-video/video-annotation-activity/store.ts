import type {
  AnnotationGroup,
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "@/context/AnnotationContext";
import { writable } from "svelte/store";

type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

export const selectedAnnotation = writable<TAnnotationObj | undefined>(undefined);

export function deselectAnnotation() {
  selectedAnnotation.set(undefined);
}

export const selectedAnnotationGroup = writable<AnnotationGroup<TAnnotationObj> | undefined>(undefined);

export function deselectAnnotationGroup() {
  selectedAnnotationGroup.set(undefined);
}
