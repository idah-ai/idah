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
import { ENTRY_ROOT } from "$lib/types";
import type { IVideoAnnotationShape } from "$lib/types";
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

      return {
        command: { ...command },
        async do() {
          // Reset from any previous redo cycle
          createdIds.length = 0;

          // ── Defensive: reject ENTRY_ROOT in clipboard ────────────────
          // This should be unreachable given copy-time rejection, but paste
          // must never create a second ENTRY_ROOT.
          if (clipboardData.some((e) => (e.shape as any)?.type === ENTRY_ROOT)) {
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

            // Defensive: fully out-of-bounds should be unreachable given the
            // copy-time bounds invariant (see plan §2.3 step 2). Skip this
            // entry if it somehow occurs.
            if (shifted.outOfBounds) {
              console.error(
                "Paste: invariant violation — shifted annotation is entirely out of bounds. " +
                "This should not happen given the copy-time frame-coverage check. Skipping entry.",
                { entryId: newId, delta, start: shifted.start, end: shifted.end },
              );
              continue;
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
            } catch (err) {
              console.error("Paste: failed to create annotation", err);
            }
          }

          // Select the newly created annotations
          if (createdIds.length > 0) {
            selection.selectAnnotations(createdIds);
          }

          // ── Toast based on how many entries were actually created ────
          const total = clipboardData.length;
          const created = createdIds.length;
          if (created === total) {
            showToast.success({
              title: "Pasted",
              description: `${created} annotation(s) pasted`,
            });
          } else if (created > 0) {
            showToast.warning({
              title: "Pasted",
              description: `${created} of ${total} annotations pasted — some failed to save.`,
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
          // Restore previous selection if the pasted set is no longer valid.
          if (selection.selectedAnnotations.every((a) => createdIds.includes(a.id))) {
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
