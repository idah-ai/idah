import { SvelteMap } from "svelte/reactivity";

import AnnotationTrackBlock from "$lib/plugin/video-annotation-activity/components/Timeline/annotations/_AnnotationTrackBlock.svelte";

import { TRACK_HEIGHT } from "$lib/plugin/video-annotation-activity/components/Timeline/constants";
import { findCategory } from "$lib/plugin/video-annotation-activity/utils/category";

import type { IConfig } from "$idah/context/activity-context";
import type { AnnotationGroup } from "$idah/context/annotation-context";
import type { VideoAnnotationObject } from "$lib/plugin/video-annotation-activity/context/video-annotation-context";
import type { TrackData } from "$lib/plugin/video-annotation-activity/components/Timeline/types";

export function groupAnnotations(annotations: VideoAnnotationObject[]): AnnotationGroup<VideoAnnotationObject>[] {
  const map = new SvelteMap<string, VideoAnnotationObject[]>();

  for (const ann of annotations) {
    const gid = ann.metadata?.metadata?.group_id ?? ann.metadata?.id;

    if (!map.has(gid)) {
      map.set(gid, []);
    }

    map.get(gid)!.push({
      ...ann,
      shape: { ...ann.shape },
    });
  }

  const groups = Array.from(map.entries()).map(([groupId, list]) => ({
    groupId,
    annotations: list
      .map((a) => ({ ...a, shape: { ...a.shape } }))
      .sort((a, b) => {
        const diff = a.shape.start - b.shape.start;
        return diff !== 0 ? diff : a.shape.end - b.shape.end;
      }),
  }));

  groups.sort((a, b) => a.annotations[0].shape.start - b.annotations[0].shape.start);

  // Sort groups by groupId ASC
  groups.sort((a, b) => a.groupId.localeCompare(b.groupId));

  return groups;
}

export function findClosestAnnotationInGroup(props: {
  annotationGroup: AnnotationGroup<VideoAnnotationObject>;
  frame: number;
}) {
  const { annotationGroup, frame } = props;
  const { annotations } = annotationGroup;
  let closestAnnotation = annotations[0];

  if (annotations.length <= 1) return annotations[0];

  let minDiff = Infinity;

  for (const annotation of annotations) {
    const start = annotation.shape.start;
    const end = annotation.shape.end;

    // If frame is within an annotation, that's the one
    if (frame >= start && frame <= end) {
      closestAnnotation = annotation;
      minDiff = 0;
      break;
    }

    // Calculate distance to nearest edge
    const diff = Math.min(Math.abs(frame - start), Math.abs(frame - end));

    if (diff < minDiff) {
      minDiff = diff;
      closestAnnotation = annotation;
    }
  }

  return closestAnnotation;
}

function categoryValueToLabel(value?: string) {
  if (!value) return "";

  const label = value.split("/").map((s) => [s.slice(0, 1).toUpperCase(), s.slice(1)].join(""));

  // remove the last part of array
  label.pop();

  return label.join(" / ");
}

export function getGroupTitle(props: {
  annotationGroup: AnnotationGroup<VideoAnnotationObject>;
  labelConfig: IConfig;
}): [string, string] {
  const { annotationGroup, labelConfig } = props;
  const { groupId, annotations: anns } = annotationGroup;
  const splittedGroupId = groupId.split("-");
  const lastPartOfGroupId = splittedGroupId[splittedGroupId.length - 1];
  const fallbackGroupTitle = `Group-${lastPartOfGroupId}`;

  const firstAnnotationInGroup = anns[0];
  const firstAnnotationCategoryId = firstAnnotationInGroup.value.category;
  if (!firstAnnotationCategoryId) return ["", fallbackGroupTitle];

  const foundCategory = findCategory({
    labelConfig: labelConfig,
    categoryId: firstAnnotationCategoryId,
    shapeType: firstAnnotationInGroup.shape.type,
  });

  if (!foundCategory) return ["", fallbackGroupTitle];

  return [categoryValueToLabel(foundCategory.id), `${foundCategory.label}-${lastPartOfGroupId}`];
}

export function transformAnnotationsToTracks(props: {
  annotations: VideoAnnotationObject[];
  labelConfig: IConfig;
}): TrackData[] {
  const { annotations, labelConfig } = props;
  const groupedAnnotations = groupAnnotations(annotations);

  const tracks = groupedAnnotations.map((group, groupIndex) => {
    let [groupTitle, groupTitleWithCategory] = getGroupTitle({ annotationGroup: group, labelConfig: labelConfig });

    return {
      id: group.groupId,
      title: groupTitleWithCategory,
      subtitle: groupTitle,
      top: groupIndex * TRACK_HEIGHT,
      items: group.annotations.map((annotation) => ({
        trackId: annotation.metadata.id,
        startRange: annotation.shape.start,
        endRange: annotation.shape.end,
        rawData: annotation,
        component: AnnotationTrackBlock,
      })),
    };
  });
  return tracks;
}
