// ---------------------------------------------------------------------------
// idah-video:annotation.extend-prev — Extend the previous annotation's end to a frame
//
// Single-selection: extends the annotation before the current frame in the
// selected group (original behaviour).
// Multi-selection: extends every selected group's closest annotation before
// the current frame.
// Undoable: restores snapshots of all modified annotations.
//
// Shortcut:  [  (default mode) — extends the annotation before the current
//            frame in the selected group.
//
// Can also be called with explicit props from the context menu:
//   driver.command.call("idah-video:annotation.extend-prev", { annotationId, frame, items });
//
// Prevents overlapping with the next annotation in the group.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { annotation } from "$lib/state/annotation.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { selection } from "$lib/state/selection.svelte";
import {
  EXTEND_PREV_CONFIG,
  resolveTargets,
  planExtendSingleGroup,
  planBatchExtendGroups,
} from "./_extend_utils";

export const command = {
  name: "idah-video:annotation.extend-prev",
  group: "Annotation",
  modes: ["editor"],
  shortcut: "BracketRight",
  shortDescription: "Extend previous annotation",
  longDescription: "Extend the previous annotation to the current frame",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      if (!isEditable()) return noopAction(command);

      // ── Plan changes at command creation time (capture snapshots) ──
      const frame = (opts?.frame as number | undefined) ?? viewport.video.currentFrame.value;
      const all = data.annotations?.items ?? [];
      if (all.length === 0) return noopAction(command);

      const isMulti = selection.selectedAnnotationIds.size > 1 || selection.selectedGroupIds.size > 1;

      let plans: { annotationId: string; snapshot: any; updated: any }[] = [];

      if (opts?.annotationId) {
        const target = all.find((a) => a.id === opts.annotationId as string);
        if (!target || annotation.isLocked(target)) return noopAction(command);
        const gid = (target.metadata as any)?.group_id ?? opts.annotationId;
        const result = planExtendSingleGroup(
          all.filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid),
          frame, EXTEND_PREV_CONFIG,
        );
        if (result) plans.push(result);
      } else if (!isMulti) {
        const sel = selection.value;
        if (!sel) return noopAction(command);
        const gid = sel.type === "group" ? sel.groupId : sel.type === "annotation" ? (sel.annotation.metadata as any)?.group_id ?? sel.annotation.id : undefined;
        if (!gid || annotation.isLocked(gid)) return noopAction(command);
        const result = planExtendSingleGroup(
          all.filter((a) => ((a.metadata as any)?.group_id ?? a.id) === gid),
          frame, EXTEND_PREV_CONFIG,
        );
        if (result) plans.push(result);
      } else {
        const targets = resolveTargets();
        if (targets.length === 0) return noopAction(command);
        // const allGids = new Set(targets.map((t) => (t.metadata as any)?.group_id ?? t.id));

        // Filter out locked groups — extend only unlocked ones
        const unlockedTargets = targets.filter((t) => {
          const gid = (t.metadata as any)?.group_id ?? t.id;
          return gid != null && !annotation.isLocked(gid);
        });
        if (unlockedTargets.length === 0) return noopAction(command);
        plans = planBatchExtendGroups(unlockedTargets, frame, EXTEND_PREV_CONFIG);
      }

      if (plans.length === 0) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          for (const { updated } of plans) {
            await data.annotations!.update(updated);
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const { snapshot } of plans) {
            await data.annotations.update(snapshot);
          }
        },
        isCombinable() { return false; },
        combine(p: never) { return p; },
      };
    },
  });
}
