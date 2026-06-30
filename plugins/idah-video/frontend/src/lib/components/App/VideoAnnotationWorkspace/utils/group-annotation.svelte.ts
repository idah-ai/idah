import { SvelteMap } from "svelte/reactivity";

import AnnotationTrackBlock from "$lib/components/App/Timeline/annotations/_AnnotationTrackBlock.svelte";

import { TRACK_HEIGHT } from "$lib/components/App/Timeline/constants";
import { findCategory } from "$lib/components/App/VideoAnnotationWorkspace/utils/category";

import { compareGroups, categoryValueToLabel } from "$lib/utils/annotation";
import type { IConfig } from "$idah/v2/types";

interface AnnotationGroup<T> {
  groupId: string;
  annotations: T[];
}
import type { IVideoAnnotationRecord } from "$lib/types";
import type { TrackData } from "$lib/components/App/Timeline/types";

export function groupAnnotations(annotations: IVideoAnnotationRecord[]): AnnotationGroup<IVideoAnnotationRecord>[] {
  const map = new SvelteMap<string, IVideoAnnotationRecord[]>();

  for (const ann of annotations) {
    const gid = ann.metadata?.group_id ?? ann.id;

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

  groups.sort(compareGroups);

  return groups;
}

export function findClosestAnnotationInGroup(props: {
  annotationGroup: AnnotationGroup<IVideoAnnotationRecord>;
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

export function getGroupTitle(props: {
  annotationGroup: AnnotationGroup<IVideoAnnotationRecord>;
  labelConfig: IConfig;
}): [string, string] {
  const { annotationGroup, labelConfig } = props;
  const { groupId, annotations: anns } = annotationGroup;
  const splittedGroupId = groupId.split("-");
  const lastPartOfGroupId = splittedGroupId[splittedGroupId.length - 1];
  const fallbackGroupTitle = `Group-${lastPartOfGroupId}`;

  const firstAnnotationInGroup = anns[0];
  const firstAnnotationCategoryId = firstAnnotationInGroup.value?.category;
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
  annotations: IVideoAnnotationRecord[];
  labelConfig: IConfig;
}): TrackData[] {
  const { annotations, labelConfig } = props;
  const groupedAnnotations = groupAnnotations(annotations);

  const tracks: TrackData[] = [];

  groupedAnnotations.forEach((group) => {
    let [groupTitle, groupTitleWithCategory] = getGroupTitle({ annotationGroup: group, labelConfig: labelConfig });

    tracks.push({
      id: group.groupId,
      title: groupTitleWithCategory,
      subtitle: groupTitle,
      top: (tracks.length) * TRACK_HEIGHT,
      items: group.annotations.map((annotation) => ({
        trackId: (annotation.metadata?.id ?? annotation.id) as string,
        startRange: annotation.shape.start,
        endRange: annotation.shape.end,
        rawData: annotation,
        component: AnnotationTrackBlock,
      })),
    });
  });

  return tracks;
}
