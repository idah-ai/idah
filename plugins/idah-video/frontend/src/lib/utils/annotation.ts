// ---------------------------------------------------------------------------
// utils/annotation.ts — Shared annotation / group helpers
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";

/**
 * Compare two groups for stable timeline track ordering.
 *
 * Primary key: `groupId` lexicographic order.
 * `groupId` is immutable — it never changes through split, delete, or update
 * operations — so tracks cannot jump position when an annotation inside a group
 * is removed. Lexicographic order is stable across undo/redo cycles because the
 * ID never changes, regardless of UUID version.
 *
 * Secondary key: first annotation's start frame (tiebreaker only; two distinct
 * groups cannot share the same groupId in practice).
 *
 * Previous behaviour sorted by start frame first, which caused a track to move
 * when the earliest-starting annotation in the group was deleted (e.g. after a
 * split + delete-left operation the remaining right-side piece has a later start
 * frame and the group dropped to a lower track position).
 */
export function compareGroups(a: { groupId: string; annotations: { shape: { start: number } }[] }, b: { groupId: string; annotations: { shape: { start: number } }[] }): number {
  const byGroupId = a.groupId.localeCompare(b.groupId);
  if (byGroupId !== 0) return byGroupId;
  return (a.annotations[0]?.shape.start ?? Infinity) - (b.annotations[0]?.shape.start ?? Infinity);
}

/** Format a category path like "vehicles/car" into a human-readable label like "Vehicles / Car". */
export function categoryValueToLabel(value?: string, replaceLabel?: string): string {
  if (!value) return "";
  const label = value.split("/").map((s) => s.slice(0, 1).toUpperCase() + s.slice(1));
  if (replaceLabel) {
    label[label.length - 1] = replaceLabel;
  } else {
    label.pop();
  }
  return label.join(" / ");
}

/**
 * Return all unique group IDs in the timeline display order.
 *
 * The order matches the timeline track rendering so that keyboard
 * navigation (ArrowUp / ArrowDown) follows the visual order.
 */
export function getSortedGroupIds(): string[] {
  if (!data.annotations) return [];
  const seen = new Set<string>();
  const groups: { groupId: string; annotations: { shape: { start: number } }[] }[] = [];

  for (const ann of data.annotations.items) {
    const gid = (ann as any).metadata?.group_id ?? ann.id;
    if (seen.has(gid)) continue;
    seen.add(gid);
    // Find or create group
    let group = groups.find((g) => g.groupId === gid);
    if (!group) {
      group = { groupId: gid, annotations: [] };
      groups.push(group);
    }
    group.annotations.push({ shape: { start: (ann.shape as any)?.start ?? Infinity } });
  }

  groups.sort(compareGroups);

  return groups.map((g) => g.groupId);
}
