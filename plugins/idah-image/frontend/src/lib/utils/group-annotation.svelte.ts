import { SvelteMap } from "svelte/reactivity";

import type { AnnotationGroup } from "$lib/context/annotation-context";
import type { ImageAnnotationObject } from "$lib/context/image-annotation-context";

export function groupAnnotations(annotations: ImageAnnotationObject[]): AnnotationGroup<ImageAnnotationObject>[] {
  const map = new SvelteMap<string, ImageAnnotationObject[]>();

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
