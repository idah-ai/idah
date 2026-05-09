// ---------------------------------------------------------------------------
// utils/annotation.ts — Shared annotation / group helpers
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";

/**
 * Compare two groups by their first annotation's start frame, then by group ID.
 * This is the single source of truth for group ordering in the timeline
 * and keyboard navigation.
 */
export function compareGroups(a: { groupId: string; annotations: { shape: { start: number } }[] }, b: { groupId: string; annotations: { shape: { start: number } }[] }): number {
  const byStart = (a.annotations[0]?.shape.start ?? Infinity) - (b.annotations[0]?.shape.start ?? Infinity);
  if (byStart !== 0) return byStart;
  return a.groupId.localeCompare(b.groupId);
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
