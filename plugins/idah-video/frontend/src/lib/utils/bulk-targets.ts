import type { IAnnotationRecord } from "$idah/v2/types";

export function resolveBulkTargets(
  annotationIds: Iterable<string>,
  groupIds: Iterable<string>,
  entryItems: IAnnotationRecord[],
): { items: IAnnotationRecord[]; missingAnnotationIds: string[]; missingGroupIds: string[] } {
  const byId = new Map(entryItems.map((item) => [item.id, item]));
  const selectedAnnotations = new Set(annotationIds);
  const selectedGroups = new Set(groupIds);
  const missingAnnotationIds = [...selectedAnnotations].filter((id) => !byId.has(id));
  const foundGroups = new Set<string>();
  const items: IAnnotationRecord[] = [];

  for (const item of byId.values()) {
    const groupId = item.metadata?.group_id ?? item.id;
    if (selectedGroups.has(groupId)) foundGroups.add(groupId);
    if (selectedAnnotations.has(item.id) || selectedGroups.has(groupId)) items.push(item);
  }

  return {
    items,
    missingAnnotationIds,
    missingGroupIds: [...selectedGroups].filter((id) => !foundGroups.has(id)),
  };
}
