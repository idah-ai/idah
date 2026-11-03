import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import type { BulkCategoryUpdate } from "$lib/utils/bulk-category";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { stripTileKeys } from "$lib/mask/strip-tile-keys";
import { IMAGE_MASK } from "$lib/types";
import { hasMaskCategoryCollision, hasMixedShapeTypes } from "$lib/utils/bulk-category";
import { noopAction } from "..";

export const command = {
  name: "idah-image:annotation.bulk-update",
  group: "Annotation",
  modes: [] as string[],
  shortcut: null,
  shortDescription: "Update selected annotation categories and properties",
  longDescription: null,
};

export interface BulkUpdateProps {
  updates: BulkCategoryUpdate[];
}

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    ...command,
    callback: (opts?: Record<string, unknown>) => {
      const updates = (opts as unknown as BulkUpdateProps | undefined)?.updates;
      if (!isEditable() || ["completed", "errored"].includes(driver.entryStatus) || !data.annotations || !updates?.length) return noopAction(command);
      const ids = new Set(updates.map((update) => update.id));
      if (ids.size !== updates.length) return noopAction(command);

      const snapshots = updates.map((update) => data.annotations!.items.find((item) => item.id === update.id));
      if (snapshots.some((item) => !item || annotation.isLocked(item) || annotation.isHidden(item))) {
        return noopAction(command);
      }
      const originals = snapshots.map((item) => ({
        ...item!, properties: { ...item!.properties }, shape_args: { ...item!.shape_args },
      }));
      if (hasMixedShapeTypes(originals)) return noopAction(command);
      if (originals.some((item, index) =>
        !driver.config[item.shape_type]?.values.some((value) => value.id === updates[index].category))) {
        return noopAction(command);
      }
      if (originals.some((item, index) => item.shape_type === IMAGE_MASK && item.category !== updates[index].category) &&
        hasMaskCategoryCollision(updates, data.annotations.items)) return noopAction(command);

      const write = async (records: AnnotationItem[]) => {
        if (!data.annotations) return;
        for (const record of records) {
          await data.annotations.update({
            ...record,
            shape_args: stripTileKeys(record.shape_args),
          });
        }
      };

      let didApply = false;
      return {
        command: { ...command },
        async do() {
          if (!isEditable() || ["completed", "errored"].includes(driver.entryStatus) ||
            !data.annotations || updates.some((update, index) => {
              const item = data.annotations!.items.find((candidate) => candidate.id === update.id);
              return !item || item.shape_type !== originals[index].shape_type || annotation.isLocked(item) || annotation.isHidden(item);
            }) ||
            (originals.some((item, index) => item.shape_type === IMAGE_MASK && item.category !== updates[index].category) &&
              hasMaskCategoryCollision(updates, data.annotations.items))) return;
          didApply = true;
          await write(originals.map((item, index) => ({
            ...item,
            category: updates[index].category,
            properties: { ...updates[index].properties },
          })));
        },
        async undo() {
          if (!didApply) return;
          await write(originals);
          didApply = false;
        },
        isCombinable() { return false; },
        combine(previous: ICommandAction) { return previous; },
      };
    },
  });
}
