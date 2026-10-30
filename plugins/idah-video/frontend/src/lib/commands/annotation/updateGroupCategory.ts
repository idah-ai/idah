// ---------------------------------------------------------------------------
// idah-video:annotation.update-group-category — Update category for all annotations in a group
// Undoable: restores previous categories.
//
// Usage:
//   driver.command.call("idah-video:annotation.update-group-category", {
//     groupId: "...",
//     categoryIdToBeUpdate: "new-category-id"
//   });
// ---------------------------------------------------------------------------
import { data } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { pruneHiddenProperties } from "$lib/utils/prune-hidden-properties";

export const command = {
  name: "idah-video:annotation.update-group-category",
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
      if (!isEditable()) return noopAction(command);

      const props = opts as unknown as UpdateGroupCategoryProps | undefined;
      if (!props || !data.annotations) return noopAction(command);

      // Find all annotations in this group by checking metadata.group_id (with id fallback)
      const allItems = data.annotations.items;
      const groupAnnotations = allItems.filter((ann) => ((ann as any).metadata?.group_id ?? ann.id) === props.groupId);

      if (groupAnnotations.length === 0) return noopAction(command);

      const snapshots: AnnotationItem[] = groupAnnotations.map((ann) => ({
        ...ann, properties: { ...ann.properties },
      }));
      const updates = snapshots.map((ann) => {
        const prepared = pruneHiddenProperties(driver, ann.shape_type, props.categoryIdToBeUpdate, ann.properties ?? {});
        return prepared && { ...ann, category: props.categoryIdToBeUpdate, properties: prepared.properties };
      });
      if (updates.some((item) => !item)) return noopAction(command);

      return {
        command: { ...command },
        async do() {
          for (const item of updates) await data.annotations!.update(item!);
        },
        async undo() {
          if (!data.annotations) return;
          for (const item of snapshots) await data.annotations!.update(item);
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      };
    },
    group: command.group,
  });
}
