import { writable } from "svelte/store";
import type { VideoAnnotation } from "./VideoAnnotationContext";
import type { AnnotationMetadata, AnnotationObj, AnnotationShape, AnnotationValue } from "@/context/AnnotationContext";
import { SvelteDate, SvelteMap } from "svelte/reactivity";

export const idb_updated_at = writable<Date>(new SvelteDate());
export const boundingBoxes = writable<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]>([]);
export const uncategorizedAnnotations = writable<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>[]>(
  [],
);
export const annotationsCategory = writable<Map<string, VideoAnnotation[]>>(new SvelteMap());
export const bbrange = writable<{ min: number; max: number }>({ min: 0, max: 0 });
export const entryRoot = writable<AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata> | undefined>();
