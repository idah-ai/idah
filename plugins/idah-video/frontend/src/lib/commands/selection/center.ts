// ---------------------------------------------------------------------------
// selection.center — Center viewport on the selected annotation's AABB
// Undoable: restores the previous viewport transform.
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { IVideoFrameSelection } from "$idah/v2/video-types";

function hasAnnotationSelection(): boolean {
  return selection.value?.type === "annotation";
}

export const command = {
  name: "selection.center",
  group: "Selection",
  modes: ["default", "review"],
  shortcut: null as string | null,
  shortDescription: "Center on selection",
  longDescription: "Pan and zoom to fit the selected annotation in the viewport",
};

let _previousTransform = { translate: [0, 0] as [number, number], scale: 1 };

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
          if (sel?.type !== "annotation") return;
          const record = sel.annotation as any;
          const shape = record.shape as { frames?: IVideoFrameSelection[]; type: string; [key: string]: unknown };
          const currentFrame = viewport.video.currentFrame.value;
          const frameData = shape.frames?.find((f) => f.frame === currentFrame);
          const points = frameData?.points;
          if (!points || points.length === 0) return;

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const [px, py] of points) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }

          const vpW = viewport.workspace.dimensions[0];
          const vpH = viewport.workspace.dimensions[1];
          if (vpW === 0 || vpH === 0) return;

          const bboxW = (maxX - minX);
          const bboxH = (maxY - minY);
          const padding = 0.1;

          const scaleX = vpW / (bboxW * (1 + padding * 2));
          const scaleY = vpH / (bboxH * (1 + padding * 2));
          const newScale = Math.min(scaleX, scaleY, 10);

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          _previousTransform = prev;
          viewport.workspace.transform.translate = [
            vpW / 2 - centerX * newScale,
            vpH / 2 - centerY * newScale,
          ];
          viewport.workspace.transform.scale = newScale;
        },
        undo() {
          viewport.workspace.transform.translate = _previousTransform.translate;
          viewport.workspace.transform.scale = _previousTransform.scale;
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: hasAnnotationSelection,
  });
}
