// ---------------------------------------------------------------------------
// idah-video:selection.paste — Paste copied annotations from clipboard
//
// Creates new annotations with the same shape data, category, and frame timing
// as the copied ones, but with new IDs and new group IDs.
// Pasted annotations are placed at the given cursor position (or, if absent,
// at the center of the viewport).
//
// Timeline-anchored paste: every keyframe is shifted by
// (pasteFrame - copyFrame) so the annotation's geometry at the copy-time
// playhead lands at the paste-time playhead. If the shifted range clips past
// the video bounds, boundary keyframes are synthesized via interpolation.
//
// Usage:
//   driver.command.call("selection.paste", { x: 0.5, y: 0.5 });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { clipboard } from "$lib/state/clipboard.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { media } from "$lib/state/media.svelte";
import { shiftAndClampShape } from "$lib/utils/frame-shift";
import { ENTRY_ROOT, VIDEO_FRAME } from "$lib/types";
import type { IVideoAnnotationShape, IVideoAnnotationRecord } from "$lib/types";
import { findFrameAnnotation } from "$lib/utils/tagging-annotations";
import { uuidv7 } from "uuidv7";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";

export const command = {
  name: "idah-video:selection.paste",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Control+V",
  shortDescription: "Paste copied annotations",
  longDescription: "Paste annotations from the clipboard at the cursor position. Keyframes are shifted along the timeline so the copied geometry lands at the current playhead frame.",
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

      if (!clipboard.hasData) return noopAction(command);

      const clipboardData = clipboard.annotations!;
      const centroid = clipboard.centroid;
      // Captured with the data: the clipboard may be replaced before a redo.
      const clipboardKind = clipboard.selectionKind;

      // Resolve the paste position ONCE at callback time (when the command is
      // first invoked by call()).  This ensures undo/redo always paste at the
      // same position, even if the cursor or playback head has moved.
      const captureX = (opts?.x as number | undefined) ?? viewport.cursor[0];
      const captureY = (opts?.y as number | undefined) ?? viewport.cursor[1];
      const capturePastePos: [number, number] = [captureX, captureY];
      // Capture the paste-time playhead frame at callback time for redo determinism.
      const capturePasteFrame = viewport.video.currentFrame.value;

      // Shared between do() and undo() — tracks the IDs created by this paste.
      const createdIds: string[] = [];
      // New group ids minted by this paste, in creation order — used to restore
      // a group selection when the copy was made from one.
      const createdGroupIds: string[] = [];

      return {
        command: { ...command },
        async do() {
          // Reset from any previous redo cycle
          createdIds.length = 0;
          createdGroupIds.length = 0;
          let skippedDuplicateTagCount = 0;
          let skippedOutOfBoundsCount = 0;

          // ── Defensive: reject ENTRY_ROOT in clipboard ────────────────
          // This should be unreachable given copy-time rejection, but paste
          // must never create a second ENTRY_ROOT.
          if (clipboardData.some((e) => (e.shape as any)?.type === ENTRY_ROOT)) {
            clipboard.clear();
            showToast.error({
              title: "Paste failed",
              description: "The clipboard contains an item that can't be pasted.",
            });
            return;
          }

          // Map original group IDs → new group IDs
          const groupMap = new Map<string, string>();

          // Use the captured values so undo/redo are deterministic regardless
          // of cursor position or playback head at redo time.
          const pastePos = capturePastePos;
          const pasteFrame = capturePasteFrame;

          // Compute the temporal delta once, shared by every entry.
          const delta = pasteFrame - clipboard.copyFrame;

          // Bounds for clamping.
          const MIN_FRAME = 0;
          const MAX_FRAME = media.totalFrames - 1;

          // Spatial anchor is the clipboard centroid (interpolated at copyFrame).
          const anchor: [number, number] = centroid;
          const dx = pastePos[0] - anchor[0];
          const dy = pastePos[1] - anchor[1];

          for (const entry of clipboardData) {
            // Generate new group ID for this original group
            if (!groupMap.has(entry.groupId)) {
              groupMap.set(entry.groupId, uuidv7());
            }
            const newGroupId = groupMap.get(entry.groupId)!;

            const newId = uuidv7();

            // Shift and clamp the annotation's keyframes along the timeline.
            const shifted = shiftAndClampShape(
              entry.shape as IVideoAnnotationShape,
              delta,
              MIN_FRAME,
              MAX_FRAME,
            );

            // Non-anchor group members may land entirely outside the video
            // bounds after the shared delta shift — that's expected, not a
            // bug. Silently skip this entry.
            if (shifted.outOfBounds) {
              skippedOutOfBoundsCount++;
              continue;
            }

            // ── VIDEO_FRAME duplicate guard ────────────────────────────
            // At most one idah-video:frame annotation per (frame, category).
            // If a tag of the same category already exists at the target frame,
            // skip creating a duplicate rather than silently overwriting.
            if ((entry.shape as any)?.type === VIDEO_FRAME) {
              const category = (entry.value as any)?.category as string | undefined;
              if (category) {
                const conflict = findFrameAnnotation(
                  (data.annotations?.items ?? []) as IVideoAnnotationRecord[],
                  shifted.start, // === shifted.end for a single-keyframe tag
                  category,
                );
                if (conflict) {
                  skippedDuplicateTagCount++;
                  continue;
                }
              }
            }

            // Apply spatial offset (dx, dy) to every point in the shifted frames.
            const newFrames = shifted.frames.map((f) => ({
              ...f,
              points: f.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy]),
            }));

            const newShape = {
              ...entry.shape,
              start: shifted.start,
              end: shifted.end,
              frames: newFrames,
            };

            const newMetadata = entry.metadata ? { ...entry.metadata, group_id: newGroupId } : { group_id: newGroupId };

            try {
              await data.annotations!.create({
                id: newId,
                shape: newShape,
                value: entry.value ?? {},
                metadata: newMetadata,
              } as any);
              createdIds.push(newId);
              if (!createdGroupIds.includes(newGroupId)) createdGroupIds.push(newGroupId);
            } catch (err) {
              console.error("Paste: failed to create annotation", err);
            }
          }

          // ── Restore the copy-time selection kind ─────────────────────
          // A group copy re-selects the new groups (so the whole pasted track
          // stays selected); an annotation copy re-selects the new annotations.
          if (createdIds.length > 0) {
            if (clipboardKind === "group") {
              selection.selectGroups(createdGroupIds);
            } else {
              selection.selectAnnotations(createdIds);
            }
          }

          // ── Toast based on how many entries were actually created ────
          const total = clipboardData.length;
          const created = createdIds.length;
          const skipped = total - created;
          if (created === total) {
            showToast.success({
              title: "Pasted",
              description: `${created} annotation(s) pasted`,
            });
          } else if (created > 0) {
            // Compose a description from all skip reasons that apply.
            const reasons: string[] = [];
            if (skippedDuplicateTagCount > 0) {
              reasons.push(`${skippedDuplicateTagCount} already tagged`);
            }
            if (skippedOutOfBoundsCount > 0) {
              reasons.push(`${skippedOutOfBoundsCount} outside video bounds`);
            }
            const failedCount = skipped - skippedDuplicateTagCount - skippedOutOfBoundsCount;
            if (failedCount > 0) {
              reasons.push(`${failedCount} failed to save`);
            }
            showToast.warning({
              title: "Pasted",
              description: `${created} of ${total} annotations pasted — ${reasons.join(", ")}.`,
            });
          } else if (skippedDuplicateTagCount > 0 && skippedOutOfBoundsCount === 0) {
            showToast.warning({
              title: "Paste skipped",
              description: `All ${total} annotation(s) skipped because the target frame(s) are already tagged with the same category.`,
            });
          } else if (skippedOutOfBoundsCount > 0 && skippedDuplicateTagCount === 0) {
            showToast.warning({
              title: "Paste skipped",
              description: `All ${total} annotation(s) skipped because they would fall outside the video bounds.`,
            });
          } else if (skippedDuplicateTagCount > 0 && skippedOutOfBoundsCount > 0) {
            showToast.warning({
              title: "Paste skipped",
              description: `All ${total} annotation(s) skipped — ${skippedDuplicateTagCount} already tagged, ${skippedOutOfBoundsCount} outside video bounds.`,
            });
          } else {
            showToast.error({
              title: "Paste failed",
              description: "No annotations could be pasted.",
            });
          }
        },
        async undo() {
          // Remove the annotations created by this paste.
          if (data.annotations) {
            for (const id of createdIds) {
              await data.annotations.delete(id);
            }
          }
          // Clear the selection if it only ever pointed at what this paste
          // created — either kind, depending on how the paste re-selected.
          const selectsOnlyPasted =
            selection.selectedAnnotations.every((a) => createdIds.includes(a.id)) &&
            Array.from(selection.selectedGroupIds).every((gid) => createdGroupIds.includes(gid));
          if (selectsOnlyPasted) {
            selection.deselect();
          }
        },
        isCombinable() {
          return false;
        },
        combine(p: never) {
          return p;
        },
      };
    },
  });
}
