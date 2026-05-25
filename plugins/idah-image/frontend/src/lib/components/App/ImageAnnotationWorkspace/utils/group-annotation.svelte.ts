import { SvelteMap } from "svelte/reactivity";

import { findCategory } from "$lib/components/App/ImageAnnotationWorkspace/utils/category";

import { categoryValueToLabel, compareGroups } from "$lib/utils/annotation";

import type { IConfig } from "$idah/v2/types";
import type { IImageAnnotationRecord } from "$lib/types";

interface AnnotationGroup<T> {
  groupId: string;
  annotations: T[];
}

export function groupAnnotations(annotations: IImageAnnotationRecord[]): AnnotationGroup<IImageAnnotationRecord>[] {
  const map = new SvelteMap<string, IImageAnnotationRecord[]>();

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
  annotationGroup: AnnotationGroup<IImageAnnotationRecord>;
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
  annotationGroup: AnnotationGroup<IImageAnnotationRecord>;
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
