// ---------------------------------------------------------------------------
// annotation.go_to_prev_keyframe — Jump to the previous keyframe in the
// currently selected group.
//
// If an annotation is selected, uses its group. If a group is selected,
// uses that group. Falls back to a single-frame step if nothing is selected.
//
// Shortcut: Control+ArrowLeft
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { data } from "$lib/state/data.svelte";
import { platformShortcut } from "$lib/utils/browser";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";
import type { IVideoAnnotationShape } from "$idah/v2/video-types";

export const command = {
  name: "annotation.go_to_prev_keyframe",
  group: "Annotation",
  modes: ["default", "review"],
  shortcut: platformShortcut("Control+ArrowLeft") as string | null,
  shortDescription: "Previous keyframe",
  longDescription: "Jump to the previous keyframe in the current group",
};

function getGroupKeyframes(groupId: string): number[] {
  if (!data.annotations) return [];
  const frames = new Set<number>();
  for (const ann of data.annotations.items) {
    const annGroupId = (ann as any).metadata?.group_id ?? ann.id;
    if (annGroupId !== groupId) continue;
    const shape = ann.shape as IVideoAnnotationShape;
    if (!shape.frames) continue;
    for (const f of shape.frames) frames.add(f.frame);
  }
  return [...frames].sort((a, b) => a - b);
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (): ICommandAction => {
      const currentFrame = viewport.video.currentFrame.value;
      const sel = selection.value;

      let groupId: string | undefined;
      if (sel?.type === "annotation") {
        groupId = (sel.annotation as any).metadata?.group_id ?? sel.annotation.id;
      } else if (sel?.type === "group") {
        groupId = sel.groupId;
      }

      if (!groupId) {
        return {
          command: command as any,
          do() { viewport.video.currentFrame.value = Math.max(currentFrame - 1, 0); },
          isCombinable() { return false; },
          combine(p: any) { return p; },
        };
      }

      const keyframes = getGroupKeyframes(groupId);
      let target: number | undefined;
      for (let i = keyframes.length - 1; i >= 0; i--) {
        if (keyframes[i] < currentFrame) { target = keyframes[i]; break; }
      }

      if (target === undefined) {
        return {
          command: command as any,
          do() {},
          isCombinable() { return false; },
          combine(p: any) { return p; },
        };
      }

      return {
        command: command as any,
        do() { viewport.video.currentFrame.value = target; },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
