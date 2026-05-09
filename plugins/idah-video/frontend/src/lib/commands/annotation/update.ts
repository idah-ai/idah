// ---------------------------------------------------------------------------
// annotation.update — Update an annotation's value (category, attributes, …)
// Undoable: restores the previous value.
//
// Usage:
//   driver.command.call("annotation.update", { annotation, value });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.update",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null as string | null,
  shortDescription: "Update annotation",
  longDescription: null,
};

export interface AnnotationUpdateProps {
  annotation: AnnotationItem;
  value: Record<string, unknown>;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as AnnotationUpdateProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      const record = data.annotations.items.find((r) => r.id === props.annotation.id);
      if (!record) return noopAction(command);

      const snapshot: AnnotationItem = { ...record, value: { ...record.value } };

      return {
        command: { ...command },
        async do() {
          await data.annotations!.update({
            ...snapshot,
            value: { ...(snapshot.value ?? {}), ...props.value },
          });
        },
        async undo() {
          if (!data.annotations) return;
          await data.annotations.update(snapshot);
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
