// ---------------------------------------------------------------------------
// idah-video:selection.copy — Copy selected annotations into clipboard
//
// Stores the shape, value, metadata, and group structure of every selected
// annotation so they can be pasted with the same category, frame timing,
// and group structure.
//
// Timeline-anchored copy/paste: the playhead frame at copy time is recorded
// as copyFrame. Pasting will shift every keyframe by (pasteFrame - copyFrame)
// so the annotation's geometry at copyFrame lands at the paste-time playhead.
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { clipboard } from "$lib/state/clipboard.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import { ENTRY_ROOT } from "$lib/types";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$lib/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";

export const command = {
  name: "idah-video:selection.copy",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Control+C",
  shortDescription: "Copy selected annotations",
  longDescription: "Copy selected annotations to the clipboard. The playhead frame at copy time is recorded so pasting at a different frame shifts the annotation's keyframes along the timeline.",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    group: command.group,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable()) return noopAction(command);

      return {
        command: { ...command },
        do() {
          const all = data.annotations?.items ?? [];
          if (all.length === 0) return;

          const copyFrame = viewport.video.currentFrame.value;

          // Copy only what is selected: a selected annotation alone, a selected
          // group whole. Track selection (track id = group id) is the track copy.
          const selectedIds = new Set(selection.selectedAnnotationIds);
          const selectedGids = new Set(selection.selectedGroupIds);

          const copySet = new Set<string>();
          const entries: {
            shape: Record<string, unknown>;
            value: Record<string, unknown> | undefined;
            metadata: Record<string, unknown> | undefined;
            centroidOffset: [number, number];
            groupId: string;
          }[] = [];

          for (const ann of all) {
            const gid = (ann.metadata as any)?.group_id ?? ann.id;
            if ((selectedIds.has(ann.id) || selectedGids.has(gid)) && !copySet.has(ann.id)) {
              copySet.add(ann.id);
              entries.push({
                shape: { ...(ann.shape as any) },
                value: ann.value ? { ...(ann.value as any) } : undefined,
                metadata: ann.metadata ? { ...(ann.metadata as any) } : undefined,
                centroidOffset: [0, 0], // computed below
                groupId: gid,
              });
            }
          }

          if (entries.length === 0) return;

          // ── All-or-nothing validation ────────────────────────────────
          // Check 1: ENTRY_ROOT is never copyable.
          if (entries.some((e) => (e.shape as any)?.type === ENTRY_ROOT)) {
            showToast.error({
              title: "Copy failed",
              description: "The video entry can't be copied.",
            });
            return;
          }

          // Check 2: Every candidate must cover copyFrame.
          const hasOutOfRange = entries.some((e) => {
            const s = e.shape as any;
            const start = s.start as number;
            const end = s.end as number;
            return start > copyFrame || end < copyFrame;
          });
          if (hasOutOfRange) {
            showToast.error({
              title: "Copy failed",
              description: "One or more selected annotations don't exist at the current frame. Move the playhead into their range before copying.",
            });
            return;
          }

          // ── Centroid at copyFrame ────────────────────────────────────
          // Because every entry passed the bounds check above,
          // getInterpolatedFrame is guaranteed to succeed for every entry.
          let cx = 0, cy = 0, count = 0;

          for (const entry of entries) {
            const frame = getInterpolatedFrame(entry.shape as IVideoAnnotationShape, copyFrame);
            const pts = frame?.points as [number, number][] | undefined;
            if (!pts?.length) continue;
            for (const [px, py] of pts) { cx += px; cy += py; count++; }
          }

          if (count === 0) return;
          const centroid: [number, number] = [cx / count, cy / count];

          // Compute centroid-relative offset for each entry
          for (const entry of entries) {
            const frame = getInterpolatedFrame(entry.shape as IVideoAnnotationShape, copyFrame);
            const pts = frame?.points as [number, number][] | undefined;
            if (pts?.length) {
              const ex = pts.reduce((s, p) => s + p[0], 0) / pts.length;
              const ey = pts.reduce((s, p) => s + p[1], 0) / pts.length;
              entry.centroidOffset = [ex - centroid[0], ey - centroid[1]];
            }
          }

          // Store in clipboard with copyFrame
          clipboard.store(entries, centroid, copyFrame);

          showToast.success({
            title: "Copied",
            description: `${entries.length} annotation(s) copied`,
          });
        },
        isCombinable() { return false; },
        combine(p: never) { return p; },
      };
    },
  });
}
