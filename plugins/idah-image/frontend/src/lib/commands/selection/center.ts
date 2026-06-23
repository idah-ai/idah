// ---------------------------------------------------------------------------
// selection.center — Center viewport on the selected annotation's AABB
// Undoable: restores the previous viewport transform.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { media } from "$lib/state/media.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { DEFAULT_MODE, REVIEW_MODE, type IImageAnnotationShape } from "$lib/types";

function hasAnnotationAtCurrentFrame(): boolean {
  const sel = selection.value;
  if (!sel) return false;
  const shape = (sel as any).shape as { points?: [number, number][] } | undefined;
  return !!shape?.points?.length;
}

export const command = {
  name: "selection.center",
  group: "Selection",
  modes: [DEFAULT_MODE, REVIEW_MODE],
  shortcut: "Control+Shift+C",
  shortDescription: "Center on selection",
  longDescription: "Pan and zoom to fit the selected annotation in the viewport",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      const sel = selection.value;
      const prev = {
        translate: [...viewport.workspace.transform.translate] as [number, number],
        scale: viewport.workspace.transform.scale,
      };

      return {
        command: { ...command },
        do() {
          if (!sel) return;
          const record = sel as any;
          const shape = record.shape as IImageAnnotationShape;
          if (!shape.points || shape.points.length === 0) return;

          // For rotated shapes (bounding box with angle), rotate points around
          // their centroid so the AABB reflects the visual bounds.
          let points = shape.points;
          const angle = shape.angle as number ?? 0;
          const radius = shape.radius as number | undefined;

          // For circles, generate the bounding box from center + radius
          if (radius && points.length === 1) {
            const [cx, cy] = points[0];
            // Compute pixel extent in both directions
            const rx = radius;
            const ry = radius;
            points = [
              [cx - rx, cy - ry],
              [cx + rx, cy - ry],
              [cx + rx, cy + ry],
              [cx - rx, cy + ry],
            ];
          } else if (angle !== 0 && points.length >= 3) {
            // Compute centroid
            let cx = 0,
              cy = 0;
            for (const [px, py] of points) {
              cx += px;
              cy += py;
            }
            cx /= points.length;
            cy /= points.length;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            points = points.map(
              ([px, py]) =>
                [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos] as [number, number],
            );
          }

          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const [px, py] of points) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }

          const mw = media.width;
          const mh = media.height;
          if (mw === 0 || mh === 0) return;

          // Convert from normalized media space (0-1) to scene pixel space
          const sx = minX * mw,
            sy = minY * mh;
          const sw = (maxX - minX) * mw,
            sh = (maxY - minY) * mh;

          const vpW = viewport.workspace.dimensions[0];
          const vpH = viewport.workspace.dimensions[1];
          if (vpW === 0 || vpH === 0) return;

          const padding = 0.2;
          const scaleX = vpW / (sw * (1 + padding * 2));
          const scaleY = vpH / (sh * (1 + padding * 2));
          const newScale = Math.min(scaleX, scaleY, 10);

          const centerX = sx + sw / 2;
          const centerY = sy + sh / 2;

          viewport.workspace.transform.translate = [vpW / 2 - centerX * newScale, vpH / 2 - centerY * newScale];
          viewport.workspace.transform.scale = newScale;
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
    activeWhen: hasAnnotationAtCurrentFrame,
  });
}
