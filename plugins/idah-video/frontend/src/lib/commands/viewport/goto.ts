// ---------------------------------------------------------------------------
// viewport.goto — Jump to a specific frame (non-undoable)
//
// Usage:
//   driver.command.call("viewport.goto", { frame: 120 });
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "viewport.goto",
  group: "Viewport",
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: "Go to frame",
  longDescription: "Jump to a specific frame",
};

interface ViewportGotoProps {
  frame: number;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as ViewportGotoProps | undefined;
      return {
        command: { ...command },
        do() {
          if (props) viewport.video.currentFrame.value = props.frame;
        },
        isCombinable() { return false; },
        combine(prev) { return prev; },
      };
    },
    command.group,
  );
}
