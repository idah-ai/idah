import { writable } from "svelte/store";
import type { VideoAnnotation } from "./VideoAnnotationContext";

export const idb_updated_at = writable<Date>(new Date());
export const boundingBoxes = writable<VideoAnnotation[]>([]);
export const uncategorizedAnnotations = writable<VideoAnnotation[]>([]);
export const annotationsCategory = writable<Map<string, VideoAnnotation[]>>([]);
