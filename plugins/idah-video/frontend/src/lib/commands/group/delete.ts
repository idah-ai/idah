// ---------------------------------------------------------------------------
// annotation.deleteGroup — Delete all annotations in a group
// Undoable: restores all annotations.
//
// Usage:
//   driver.command.call("annotation.deleteGroup", {
//     groupId: "...", annotations?: [ ... ]
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.deleteGroup",
  group: undefined,
  modes: [] as string[],
  shortcut: null,
  shortDescription: null,
  longDescription: null,
};

export interface GroupDeleteProps {
  groupId: string;
  annotations?: AnnotationItem[];
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as GroupDeleteProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      // Resolve annotations: use provided list, or look them up from the data store
      let groupAnnotations: AnnotationItem[];

      if (props.annotations && props.annotations.length > 0) {
        groupAnnotations = props.annotations;
      } else if (props.groupId) {
        groupAnnotations = data.annotations.items.filter(
          (ann) => (ann as any).metadata?.group_id === props.groupId
        );
      } else {
        return noopAction(command);
      }

      if (groupAnnotations.length === 0) return noopAction(command);

      const snapshot = [...groupAnnotations];

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
    group: command.group,
  });
}
