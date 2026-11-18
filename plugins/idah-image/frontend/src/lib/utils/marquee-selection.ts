import type { IAnnotationRecord } from "$idah/v2/types";

type Bounds = [number, number, number, number];

export function marqueeSelectionIds(
  items: IAnnotationRecord[],
  rect: Bounds,
  isHidden: (item: IAnnotationRecord) => boolean,
  getBounds: (item: IAnnotationRecord) => Bounds | null,
): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (isHidden(item)) continue;
    const bounds = getBounds(item);
    if (bounds && bounds[0] <= rect[2] && bounds[2] >= rect[0] &&
      bounds[1] <= rect[3] && bounds[3] >= rect[1]) ids.push(item.id);
  }
  return ids;
}
