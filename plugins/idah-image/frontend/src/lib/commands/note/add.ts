// ---------------------------------------------------------------------------
// note.add — Add a note (to the entry or to an annotation)
// Undoable: deletes the created note.
//
// Usage:
//   driver.command.call("note.add", {
//     contentMd: "Look here", anchor: { anchor_type: "entry", position: {...} }
//   });
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, INoteAnchor } from "$idah/v2/types";
import { noopAction } from "..";

export const command = {
  name: "note.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface NoteAddProps {
  contentMd: string;
  anchor: INoteAnchor;
  noteId?: string;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as NoteAddProps | undefined;
      if (!props) return noopAction(command);

      return {
        command: { ...command },
        do() {
          // With the push-based driver, notes are created via requestCreateNote.
          // This command is kept for backward compatibility but delegates to the core.
          driver.notes.requestCreateNote(props.anchor);
        },
        undo() {
          // Nothing to undo — creation is handled by the core
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
