import { SvelteMap } from "svelte/reactivity";

import { compareGroups } from "$lib/utils/annotation";

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
