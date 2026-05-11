// ---------------------------------------------------------------------------
// annotation.updateGroupCategory — Update category for all annotations in a group
// Undoable: restores previous categories.
//
// Usage:
//   driver.command.call("annotation.updateGroupCategory", {
//     groupId: "...",
//     categoryIdToBeUpdate: "new-category-id"
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";

export const command = {
  name: "annotation.updateGroupCategory",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Update group category",
  longDescription: null,
};

export interface UpdateGroupCategoryProps {
  groupId: string;
  categoryIdToBeUpdate: string;
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      const props = opts as unknown as UpdateGroupCategoryProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      // Find all annotations in this group by checking metadata.group_id
      const allItems = data.annotations.items;
      const groupAnnotations = allItems.filter(
        (ann) => (ann as any).metadata?.group_id === props.groupId
      );

      if (groupAnnotations.length === 0) return noopAction(command);

      // Snapshot old values
      const snapshots: Array<{ annotation: AnnotationItem; oldCategory?: string }> =
        groupAnnotations.map((ann) => ({
          annotation: ann,
          oldCategory: ann.value?.category as string | undefined,
        }));

      return {
        command: { ...command },
        async do() {
          for (const { annotation } of snapshots) {
            await data.annotations!.update({
              ...annotation,
              value: {
                ...(annotation.value ?? {}),
                category: props.categoryIdToBeUpdate,
              },
            });
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const { annotation, oldCategory } of snapshots) {
            await data.annotations!.update({
              ...annotation,
              value: {
                ...(annotation.value ?? {}),
                ...(oldCategory ? { category: oldCategory } : {}),
              },
            });
          }
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
  });
}
