// ---------------------------------------------------------------------------
// _extend_utils.ts — Shared utilities for extend_next / extend_prev commands
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { nearestKeyframe } from "$lib/utils/interpolation";

// ── Direction-specific finders ──────────────────────────────────────────

function findNext(group: any[], frame: number) {
  return group
    .filter((a) => (a.shape.frames?.[0]?.frame ?? Infinity) > frame)
    .sort((a, b) => (a.shape.frames?.[0]?.frame ?? Infinity) - (b.shape.frames?.[0]?.frame ?? Infinity))[0];
}

function findPrev(group: any[], frame: number) {
  return group
    .filter((a) => {
      const last = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
      return last < frame;
    })
    .sort((a, b) => {
      const aEnd = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
      const bEnd = b.shape.frames?.[b.shape.frames.length - 1]?.frame ?? -1;
      return bEnd - aEnd;
    })[0];
}

// ── Overlap protection ─────────────────────────────────────────────────

function capNext(group: any[], target: { id: string; shape: any }, frame: number) {
  const prev = group
    .filter((a) => {
      const last = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
      return last < frame && a.id !== target.id;
    })
    .sort((a, b) => {
      const aEnd = a.shape.frames?.[a.shape.frames.length - 1]?.frame ?? -1;
      const bEnd = b.shape.frames?.[b.shape.frames.length - 1]?.frame ?? -1;
      return bEnd - aEnd;
    })[0];
  if (!prev) return frame;
  const prevEnd = prev.shape.frames?.[prev.shape.frames.length - 1]?.frame ?? -Infinity;
  return frame <= prevEnd ? prevEnd + 1 : frame;
}

function capPrev(group: any[], target: { id: string; shape: any }, frame: number) {
  const next = group
    .filter((a) => {
      const first = a.shape.frames?.[0]?.frame ?? Infinity;
      return first > frame && a.id !== target.id;
    })
    .sort((a, b) => (a.shape.frames?.[0]?.frame ?? Infinity) - (b.shape.frames?.[0]?.frame ?? Infinity))[0];
  if (!next) return frame;
  const nextStart = next.shape.frames?.[0]?.frame ?? Infinity;
  return frame >= nextStart ? nextStart - 1 : frame;
}

// ── Config ──────────────────────────────────────────────────────────────

export interface ExtendConfig {
  direction: "next" | "prev";
  findTarget: typeof findNext;
  capFrame: typeof capNext;
  /** Return true when the group should be SKIPPED (nothing to extend). */
  batchGuard: (group: any[], frame: number) => boolean;
}

export const EXTEND_NEXT_CONFIG: ExtendConfig = {
  direction: "next",
  findTarget: findNext,
  capFrame: capNext,
  batchGuard: (group, frame) => {
    const lastEnd = group.reduce((best, a) => {
      const frames = (a.shape.frames as any[]) ?? [];
      const last = frames.length > 0 ? (frames[frames.length - 1]?.frame as number) ?? -1 : -1;
      return last > best ? last : best;
    }, -1);
    return frame > lastEnd;
  },
};

export const EXTEND_PREV_CONFIG: ExtendConfig = {
  direction: "prev",
  findTarget: findPrev,
  capFrame: capPrev,
  batchGuard: (group, frame) => {
    const firstStart = group.reduce((best, a) => {
      const frames = (a.shape.frames as any[]) ?? [];
      const first = frames.length > 0 ? (frames[0]?.frame as number) ?? Infinity : Infinity;
      return first < best ? first : best;
    }, Infinity);
    return frame < firstStart;
  },
};

// ── Shared helpers ──────────────────────────────────────────────────────

/** Check if any annotation in the group already covers `frame`. */
function hasCovering(group: any[], frame: number): boolean {
  return group.some((a) => {
    const frames = (a.shape.frames as any[]) ?? [];
    const first = frames.length > 0 ? (frames[0]?.frame as number) ?? Infinity : Infinity;
    const last = frames.length > 0 ? (frames[frames.length - 1]?.frame as number) ?? -1 : -1;
    return first <= frame && last >= frame;
  });
}

/** Resolve selected annotations + annotations in selected groups. */
export function resolveTargets(): any[] {
  const all = data.annotations?.items ?? [];
  const selectedIds = new Set<string>(selection.selectedAnnotationIds);
  const selectedGids = new Set<string>(selection.selectedGroupIds);

  if (selectedIds.size === 0 && selectedGids.size === 0) {
    const sel = selection.value;
    if (!sel) return [];
    if (sel.type === "group") selectedGids.add(sel.groupId);
    else if (sel.type === "annotation") selectedIds.add(sel.annotation.id);
    else return [];
  }

  const targets: any[] = [];
  for (const ann of all) {
    const gid = (ann.metadata as any)?.group_id ?? ann.id;
    if (selectedIds.has(ann.id) || selectedGids.has(gid)) {
      targets.push(ann);
    }
  }
  return targets;
}

/** Extend a single group — returns planned change for do/undo, or null if no-op. */
export function planExtendSingleGroup(
  groupAnnotations: any[],
  frame: number,
  config: ExtendConfig,
): { annotationId: string; snapshot: any; updated: any } | null {
  const target = config.findTarget(groupAnnotations, frame);
  if (!target) return null;
  const cappedFrame = config.capFrame(groupAnnotations, target, frame);
  const nearest = nearestKeyframe(target.shape, cappedFrame);
  if (!nearest) return null;

  const existingFrames = [...((target.shape.frames as any[]) ?? [])];
  const existingIdx = existingFrames.findIndex((f: any) => f.frame === cappedFrame);
  if (existingIdx >= 0) existingFrames[existingIdx] = { frame: cappedFrame, ...nearest };
  else existingFrames.push({ frame: cappedFrame, ...nearest });
  existingFrames.sort((a: any, b: any) => a.frame - b.frame);

  const min = existingFrames.reduce((m: number, f: any) => Math.min(m, f.frame), Infinity);
  const max = existingFrames.reduce((m: number, f: any) => Math.max(m, f.frame), -Infinity);

  const snapshot = {
    ...target,
    shape: { ...target.shape, frames: [...((target.shape.frames as any[]) ?? [])] },
  };

  const updated = {
    ...target,
    shape: { ...target.shape, start: min, end: max, frames: existingFrames },
  };

  return { annotationId: target.id, snapshot, updated };
}

/** Batch-extend all groups — returns array of planned changes for do/undo. */
export function planBatchExtendGroups(
  targets: any[],
  frame: number,
  config: ExtendConfig,
): { annotationId: string; snapshot: any; updated: any }[] {
  const groups = new Map<string, any[]>();
  for (const t of targets) {
    const gid = (t.metadata as any)?.group_id ?? t.id;
    const g = groups.get(gid);
    if (g) g.push(t); else groups.set(gid, [t]);
  }

  const results: { annotationId: string; snapshot: any; updated: any }[] = [];

  for (const [, groupAnnotations] of groups) {
    if (hasCovering(groupAnnotations, frame)) continue;
    if (config.batchGuard(groupAnnotations, frame)) continue;

    const result = planExtendSingleGroup(groupAnnotations, frame, config);
    if (result) results.push(result);
  }

  return results;
}