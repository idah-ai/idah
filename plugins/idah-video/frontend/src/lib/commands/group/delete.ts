// ---------------------------------------------------------------------------
// group.delete — Delete all annotations in a group
// Undoable: restores all annotations.
//
// Usage:
//   driver.command.call("group.delete", {
//     groupId: "...", annotations: [ ... ]
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "group.delete",
  modes: [] as string[],
  shortcut: null as [string | null, string] | null,
  shortDescription: null,
  longDescription: null,
};

export interface GroupDeleteProps {
  groupId: string;
  annotations: AnnotationItem[];
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register(
    command.name, command.modes, command.shortcut,
    command.shortDescription, command.longDescription,
    (opts?: Record<string, unknown>) => {
      const props = opts as unknown as GroupDeleteProps | undefined;
      if (!props || !data.annotations || props.annotations.length === 0) return noopAction(command);

      const snapshot = [...props.annotations];

      return {
        command: { ...command },
        async do() {
          for (const ann of snapshot) {
            await data.annotations!.delete(ann.id);
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const ann of snapshot) {
            await data.annotations!.create({ ...ann, id: ann.id });
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
  );
}
