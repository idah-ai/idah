// ---------------------------------------------------------------------------
// note.goto — Navigate to a note's anchor position
// Undoable: returns to the previous frame.
//
// Usage:
//   driver.command.call("note.goto", { noteId: "..." });
// ---------------------------------------------------------------------------
import { viewport } from "$lib/state/viewport.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";

export const command = {
  name: "note.goto",
  group: undefined,
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null,
  longDescription: null,
};

export interface NoteGotoProps {
  noteId: string;
}

let _previousFrame = 1;

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as NoteGotoProps | undefined;
      const prevFrame = viewport.video.currentFrame.value;
      return {
        command: { ...command },
        async do() {
          if (!props) return;
          _previousFrame = prevFrame;
        },
        undo() {
          viewport.video.currentFrame.value = _previousFrame;
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
