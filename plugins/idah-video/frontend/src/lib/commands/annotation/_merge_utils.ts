// ---------------------------------------------------------------------------
// _merge_utils.ts — Shared utilities for the annotation.merge command
//
// Pure planning logic (no Svelte runes). `planMerge` validates that a set of
// records are contiguous pieces of one split annotation group, then computes
// the merged record. Rule 1 (editable / review workspace) lives in the
// command; rules 2–8 and the integrity checks live here.
// ---------------------------------------------------------------------------
import { annotation } from "$lib/state/annotation.svelte";

export type MergePlan =
  | { ok: true; survivor: any; absorbed: any[]; merged: any; range: [number, number] }
  | { ok: false; reason: string };

const INCONSISTENT = "These annotations could not be merged because their keyframe data is inconsistent.";

/**
 * Compare two `properties` objects per rule 7.
 * - Object keys compare order-independently.
 * - Arrays compare as sets (order and duplicates ignored) — the only
 *   array-valued attributes are multi-select `string[]` properties.
 * - `undefined`, `null` and `{}` are all treated as "no properties".
 * - Primitives compare with `===`.
 */
export function propertiesEqual(a: unknown, b: unknown): boolean {
  const aEmpty = isEmptyProps(a);
  const bEmpty = isEmptyProps(b);
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return a === b;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!valueEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

function isEmptyProps(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "object" && Object.keys(v as object).length === 0) return true;
  return false;
}

function valueEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const aSet = new Set(a);
    const bSet = new Set(b);
    if (aSet.size !== bSet.size) return false;
    for (const item of aSet) if (!bSet.has(item)) return false;
    return true;
  }
  return a === b;
}

/**
 * Plan a merge of `records`. Returns the survivor, the absorbed pieces, the
 * merged record and the merged frame range, or a failure reason.
 */
export function planMerge(records: any[]): MergePlan {
  // Rule 2 — at least two records
  if (records.length < 2) {
    return { ok: false, reason: "Select at least two annotations to merge." };
  }

  const groupKey = (r: any) => (r.metadata?.group_id ?? r.id) as string;

  // Rule 3 — one group
  const firstKey = groupKey(records[0]);
  if (records.some((r) => groupKey(r) !== firstKey)) {
    return { ok: false, reason: "Selected annotations belong to different groups." };
  }

  // Rule 4 — unlocked
  if (records.some((r) => annotation.isLocked(r))) {
    return { ok: false, reason: "One or more selected annotations are locked." };
  }

  // Rule 5 — same shape type
  const firstType = records[0].shape_type;
  if (records.some((r) => r.shape_type !== firstType)) {
    return { ok: false, reason: "Selected annotations have different shape types." };
  }

  // Rule 6 — same category
  const firstCat = records[0].category;
  if (records.some((r) => r.category !== firstCat)) {
    return { ok: false, reason: "Selected annotations have different categories." };
  }

  // Rule 7 — deep-equal properties
  const firstProps = records[0].properties;
  if (records.some((r) => !propertiesEqual(r.properties, firstProps))) {
    return { ok: false, reason: "Selected annotations have different attributes." };
  }

  // Rule 8 — continuity (sorted by start)
  const sorted = [...records].sort((a, b) => a.shape_args.start - b.shape_args.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const next = sorted[i + 1];
    const prevEnd = prev.shape_args.end;
    const nextStart = next.shape_args.start;
    if (nextStart <= prevEnd) {
      return { ok: false, reason: `Selected annotations overlap at frame ${nextStart + 1}.` };
    }
    if (nextStart > prevEnd + 2) {
      return {
        ok: false,
        reason: `Selected annotations are not continuous (gap at frames ${prevEnd + 2}–${nextStart}).`,
      };
    }
    if (nextStart === prevEnd + 2) {
      return {
        ok: false,
        reason: `Selected annotations are not continuous (gap at frame ${prevEnd + 2}).`,
      };
    }
  }

  // ── Integrity checks ────────────────────────────────────────────────
  for (const r of records) {
    const shape = r.shape_args;
    for (const f of shape.frames ?? []) {
      if (f.frame < shape.start || f.frame > shape.end) {
        return { ok: false, reason: INCONSISTENT };
      }
    }
  }

  const allFrames = records.flatMap((r) => (r.shape_args.frames ?? []) as any[]);
  allFrames.sort((a, b) => a.frame - b.frame);
  const frameNums = allFrames.map((f) => f.frame);
  if (new Set(frameNums).size !== frameNums.length) {
    return { ok: false, reason: INCONSISTENT };
  }

  // ── Survivor ────────────────────────────────────────────────────────
  // The root piece (id === group key) survives when selected; otherwise the
  // selected piece with the lowest start.
  const root = records.find((r) => r.id === firstKey);
  const survivor = root ?? sorted[0];
  const absorbed = records.filter((r) => r.id !== survivor.id);

  const mergedStart = sorted[0].shape_args.start;
  const mergedEnd = sorted[sorted.length - 1].shape_args.end;

  const merged = {
    ...survivor,
    shape_args: {
      ...survivor.shape_args,
      start: mergedStart,
      end: mergedEnd,
      frames: allFrames,
    },
  };

  // Merged record must keep the group key
  const mergedGroupKey = (merged.metadata?.group_id ?? merged.id) as string;
  if (mergedGroupKey !== firstKey) {
    return { ok: false, reason: INCONSISTENT };
  }

  return { ok: true, survivor, absorbed, merged, range: [mergedStart, mergedEnd] };
}

/** Whether a set of records can be merged (rules 2–8 + integrity). */
export function canMerge(records: any[]): boolean {
  return planMerge(records).ok;
}
