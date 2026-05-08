// ---------------------------------------------------------------------------
// note.add — Add a note (to the entry or to an annotation)
// Undoable: deletes the created note.
//
// Usage:
//   driver.command.call("note.add", {
//     annotationId: "...", contentMd: "Look here"
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";

export const command = {
  name: "note.add",
  group: undefined,
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: null,
  longDescription: null,
};

export interface NoteAddProps {
  annotationId?: string | null;
  contentMd: string;
  anchorType?: "entry" | "annotation";
  position?: Record<string, unknown>;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as NoteAddProps | undefined;
      if (!props || !data.notes) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          const note = await data.notes!.create({
            annotation_id: props.annotationId ?? null,
            content_md: props.contentMd,
            anchor_type: props.anchorType ?? "annotation",
            position: props.position ?? {},
            resolved: false,
            status: "pending",
            created_by_email: "",
          });
          // Store the created id for undo by mutating the closure
          (this as any)._createdId = note.id;
        },
        async undo() {
          const id = (this as any)._createdId;
          if (id && data.notes) {
            await data.notes.delete(id);
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    command.group,
  );
}
