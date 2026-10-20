// ---------------------------------------------------------------------------
// idah-video:annotation.merge — Merge contiguous pieces of one split group
//
// Inverse of idah-video:annotation.split. Merges selected contiguous pieces of
// a single annotation group back into one annotation. The survivor keeps its
// id/metadata/category/properties/shape_type; every other selected piece is
// soft-deleted. Undoable: restores the survivor and re-inserts the absorbed
// pieces.
//
// Shortcut: M
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import { noopAction } from "..";
import { resolveTargets } from "./_extend_utils";
import { planMerge } from "./_merge_utils";

export const command = {
  name: "idah-video:annotation.merge",
  group: "Annotation",
  modes: ["editor"] as string[],
  shortcut: "M",
  shortDescription: "Merge selected annotations",
  longDescription: null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      // Rule 1 — editable + not in review workspace (silent)
      if (!isEditable() || viewport.isReviewWorkspace) return noopAction(command);

      // ── Resolve targets ─────────────────────────────────────────────
      let records: AnnotationItem[];
      if (opts?.annotationIds) {
        const ids = new Set(opts.annotationIds as string[]);
        const all = data.annotations?.items ?? [];
        records = all.filter((r) => ids.has(r.id)) as AnnotationItem[];
      } else {
        records = resolveTargets() as AnnotationItem[];
      }

      // ── Plan (rules 2–8 + integrity) ────────────────────────────────
      const plan = planMerge(records);
      if (!plan.ok) {
        showToast.warning({ title: "Cannot merge annotations", description: plan.reason });
        return noopAction(command);
      }

      return {
        command: { ...command },
        async do() {
          await data.annotations!.update(plan.merged);
          for (const r of plan.absorbed) await data.annotations!.delete(r.id);
          selection.selectAnnotation(plan.merged);
          showToast.success({
            title: "Annotations merged",
            description: `Merged frames ${plan.range[0] + 1}–${plan.range[1] + 1}`,
          });
        },
        async undo() {
          await data.annotations!.update(plan.survivor);
          for (const r of plan.absorbed) await data.annotations!.restore(r);
          selection.selectAnnotations([plan.survivor.id, ...plan.absorbed.map((r) => r.id)]);
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      };
    },
    group: command.group,
    activeWhen: () => isEditable() && !viewport.isReviewWorkspace && selection.hasSelection(),
  });
}
