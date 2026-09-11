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
import type { ClipboardAnnotation, ClipboardSelectionKind } from "$lib/state/clipboard.svelte";
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

          // A selection is either a group selection or an annotation selection,
          // never both. That one fact decides what gets copied, how the frame
          // coverage is validated, and how paste re-selects the result — so
          // resolve it once, up front.
          const selectedGids = new Set(selection.selectedGroupIds);
          const selectedIds = new Set(selection.selectedAnnotationIds);
          const selectionKind: ClipboardSelectionKind = selectedGids.size > 0 ? "group" : "annotation";

          const groupIdOf = (ann: (typeof all)[number]) => (ann.metadata as any)?.group_id ?? ann.id;

          // A group copies whole (track selection — track id = group id),
          // including members the user never selected individually and members
          // outside the current frame. An annotation copies alone.
          const isCopied =
            selectionKind === "group"
              ? (ann: (typeof all)[number]) => selectedGids.has(groupIdOf(ann))
              : (ann: (typeof all)[number]) => selectedIds.has(ann.id);

          const entries: ClipboardAnnotation[] = all.filter(isCopied).map((ann) => ({
            shape: { ...(ann.shape as any) },
            value: ann.value ? { ...(ann.value as any) } : undefined,
            metadata: ann.metadata ? { ...(ann.metadata as any) } : undefined,
            centroidOffset: [0, 0], // computed below
            groupId: groupIdOf(ann),
          }));

          if (entries.length === 0) return;

          // ── All-or-nothing validation ────────────────────────────────
          // Check 1: ENTRY_ROOT is never copyable.
          if (entries.some((e) => (e.shape as any)?.type === ENTRY_ROOT)) {
            clipboard.clear();
            showToast.error({
              title: "Copy failed",
              description: "The video entry can't be copied.",
            });
            return;
          }

          // Check 2: Frame-coverage validation, per selection kind.
          //
          // An annotation copy is strict: every entry must cover copyFrame
          // itself.
          //
          // A group copy only needs at least ONE member of each group (the
          // "anchor") to cover copyFrame. Non-anchor members are copied
          // anyway; their keyframes will be shifted by the same delta at
          // paste time, preserving relative timing within the track.
          const outOfRange = (e: (typeof entries)[number]) => {
            const s = e.shape as any;
            return (s.start as number) > copyFrame || (s.end as number) < copyFrame;
          };

          const hasOutOfRange =
            selectionKind === "group"
              ? Array.from(selectedGids).some((gid) => {
                  const members = entries.filter((e) => e.groupId === gid);
                  return members.length > 0 && !members.some((e) => !outOfRange(e));
                })
              : entries.some(outOfRange);

          if (hasOutOfRange) {
            clipboard.clear();
            showToast.error({
              title: "Copy failed",
              description: "One or more selected annotations don't exist at the current frame. Move the playhead into their range before copying.",
            });
            return;
          }

          // ── Centroid at copyFrame ────────────────────────────────────
          // Only entries that cover copyFrame contribute to the centroid;
          // non-anchor group members (which don't cover copyFrame) are
          // skipped by the `if (!pts?.length) continue` guard below.
          // This is fine — (dx, dy) is shared across the whole batch, and
          // the centroid only needs to reflect the anchor geometry.
          let cx = 0, cy = 0, count = 0;

          for (const entry of entries) {
            const frame = getInterpolatedFrame(entry.shape as IVideoAnnotationShape, copyFrame);
            const pts = frame?.points as [number, number][] | undefined;
            if (!pts?.length) continue;
            for (const [px, py] of pts) { cx += px; cy += py; count++; }
          }

          // Zero-geometry shapes (e.g. idah-video:frame per-frame tags, which have
          // no points at all) contribute nothing here — that must NOT abort the
          // copy. Fall back to [0, 0]; it's inert for such shapes since (dx, dy) is
          // only ever applied to points, and they have none.
          const centroid: [number, number] = count > 0 ? [cx / count, cy / count] : [0, 0];

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
          clipboard.store(entries, centroid, copyFrame, selectionKind);

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
