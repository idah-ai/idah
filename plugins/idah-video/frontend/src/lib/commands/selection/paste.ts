// ---------------------------------------------------------------------------
// selection.paste — Paste copied annotations from clipboard
//
// Creates new annotations with the same shape data, category, and frame timing
// as the copied ones, but with new IDs and new group IDs.
// Pasted annotations are placed at the given cursor position (or, if absent,
// at the center of the viewport).
//
// Usage:
//   driver.command.call("selection.paste", { x: 0.5, y: 0.5 });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import { selection } from "$lib/state/selection.svelte";
import { clipboard } from "$lib/state/clipboard.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { getInterpolatedFrame } from "$lib/utils/interpolation";
import { uuidv7 } from "uuidv7";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";

export const command = {
  name: "selection.paste",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Control+V",
  shortDescription: "Paste copied annotations",
  longDescription: "Paste annotations from the clipboard at the cursor position",
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

      // Shared between do() and undo() — tracks the IDs created by this paste.
      const createdIds: string[] = [];

      return {
        command: { ...command },
        async do() {
          // Paste position: explicit option (context menu), else last cursor,
          // else viewport center.
          const targetX = (opts?.x as number | undefined) ?? viewport.cursor[0];
          const targetY = (opts?.y as number | undefined) ?? viewport.cursor[1];
          const pastePos: [number, number] = [targetX, targetY];

          // Map original group IDs → new group IDs
          const groupMap = new Map<string, string>();

          for (const entry of clipboardData) {
            // Generate new group ID for this original group
            if (!groupMap.has(entry.groupId)) {
              groupMap.set(entry.groupId, uuidv7());
            }
            const newGroupId = groupMap.get(entry.groupId)!;

            const newId = uuidv7();

            // Compute offset: shift ALL annotations by the same (pastePos - centroid).
            const dx = pastePos[0] - centroid[0];
            const dy = pastePos[1] - centroid[1];

            // Truncate the pasted annotation's start to the current frame if
            // its original start is before the playhead — so the pasted shape
            // does not extend backward in time before the current frame.
            // Annotations that naturally start after the playhead are kept
            // at their original start position.
            const currentFrame = viewport.video.currentFrame.value;
            const originalStart = (entry.shape as any).start as number | undefined;
            const originalEnd = (entry.shape as any).end as number | undefined;
            const shouldTruncate = originalStart !== undefined && originalStart < currentFrame;
            const newStart = shouldTruncate ? currentFrame : (originalStart ?? 0);
            const newEnd = originalEnd ?? (originalStart ?? 0) + 1;

            // Clone the shape, offset all frame points, and drop keyframes
            // before the new start (outside the truncated range).
            const originalFrames = (entry.shape?.frames as any[]) ?? [];
            const newFrames = originalFrames
              .filter((f: any) => f.frame >= newStart)
              .map((frame: any) => {
                if (!frame?.points) return { ...frame };
                return {
                  ...frame,
                  points: frame.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy]),
                };
              });

            // If no keyframe exists at the exact new start frame, create one
            // by interpolating from the original shape's surrounding keyframes.
            // This ensures the pasted annotation always has a shape definition
            // at its first frame, even when the original didn't have a keyframe
            // at that exact position.
            if (originalFrames.length > 0 && !newFrames.some((f: any) => f.frame === newStart)) {
              const interp = getInterpolatedFrame(entry.shape as any, newStart);
              if (interp?.points?.length) {
                newFrames.push({
                  frame: newStart,
                  angle: interp.angle ?? 0,
                  points: interp.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy]),
                });
              }
            }

            const newShape = {
              ...entry.shape,
              start: newStart,
              end: newEnd,
              frames: newFrames,
            };

            const newMetadata = entry.metadata
              ? { ...entry.metadata, group_id: newGroupId }
              : { group_id: newGroupId };

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
        isCombinable() { return false; },
        combine(p: never) { return p; },
      };
    },
  });
}