import type {
  AnnotationGroup,
  AnnotationMetadata,
  AnnotationObj,
  AnnotationShape,
  AnnotationValue,
} from "@/context/AnnotationContext";
import { writable } from "svelte/store";

type TAnnotationObj = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

export const selectedAnnotationGroup = writable<AnnotationGroup<TAnnotationObj> | undefined>(undefined);
