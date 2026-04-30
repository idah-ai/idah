import { writable } from "svelte/store";

import { DEFAULT_MODE } from "$lib/plugin/type";

import type { AnnotationGroup } from "$idah/context/annotation-context";
import type {
  VideoAnnotationObject,
  VideoFrameSelection,
} from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

/** CURRENT MODE */
export const currentMode = writable<string>(DEFAULT_MODE);

export function setCurrentModeTo(mode: string) {
  currentMode.set(mode);
}

/** CURRENT FRAME */
export const currentFrame = writable<number>(1);

export function setCurrentFrame(frame: number) {
  currentFrame.set(frame);
}

/** TOTAL FRAMES */
export const totalFrames = writable<number>(0);

export function setTotalFrames(totalFrame: number) {
  totalFrames.set(totalFrame);
}

/** IS PLAYING */
export const isVideoPlaying = writable<boolean>(false);

export function setVideoIsPlaying(isPlaying: boolean) {
  isVideoPlaying.set(isPlaying);
}

/** SELECTED ANNOTATION */
export const selectedAnnotation = writable<VideoAnnotationObject | undefined>(undefined);

export function setSelectedAnnotation(annotation: VideoAnnotationObject | undefined) {
  selectedAnnotation.set(annotation);
}

export function deselectAnnotation() {
  selectedAnnotation.set(undefined);
}

/** SELECTED ANNOTATION GROUP */
export const selectedAnnotationGroup = writable<AnnotationGroup<VideoAnnotationObject> | undefined>(undefined);

export function setSelectedAnnotationGroup(annotationGroup: AnnotationGroup<VideoAnnotationObject> | undefined) {
  selectedAnnotationGroup.set(annotationGroup);
}

export function deselectAnnotationGroup() {
  selectedAnnotationGroup.set(undefined);
}

/** COPIED KEYFRAME */
export const copiedKeyframe = writable<{ annotationId: string; frameSelection: VideoFrameSelection } | null>(null);

export function setCopiedKeyframe(data: { annotationId: string; frameSelection: VideoFrameSelection } | null) {
  copiedKeyframe.set(data);
}

export function clearCopiedKeyframe() {
  copiedKeyframe.set(null);
}

// Helper function to check if keyframe is copied for specific annotation
export function hasCopiedKeyframeForAnnotation(annotationId: string, copiedData: { annotationId: string; frameSelection: VideoFrameSelection } | null): boolean {
  return copiedData !== null && copiedData.annotationId === annotationId;
}
