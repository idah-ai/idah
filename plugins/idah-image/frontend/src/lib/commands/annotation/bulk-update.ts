import type { ICommandAction, IIdahDriverV2 } from "$idah/v2/types";
import type { AnnotationItem } from "$lib/state/data.svelte";
import type { BulkCategoryUpdate } from "$lib/utils/bulk-category";
import { annotation } from "$lib/state/annotation.svelte";
import { data } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { stripTileKeys } from "$lib/mask/strip-tile-keys";
import { IMAGE_MASK } from "$lib/types";
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
      if (snapshots.some((item) => !item || annotation.isLocked(item) || annotation.isHidden(item) || item.shape_type === IMAGE_MASK)) {
        return noopAction(command);
      }
      const originals = snapshots.map((item) => ({
        ...item!, properties: { ...item!.properties }, shape_args: { ...item!.shape_args },
      }));
      const shapeType = originals[0].shape_type;
      if (originals.some((item) => item.shape_type !== shapeType) ||
        updates.some((update) => !driver.config[shapeType]?.values.some((value) => value.id === update.category))) {
        return noopAction(command);
      }

      const write = async (records: AnnotationItem[]) => {
        if (!data.annotations) return;
        for (const record of records) {
          await data.annotations.update({
            ...record,
            shape_args: stripTileKeys(record.shape_args),
          });
        }
      };

      return {
        command: { ...command },
        async do() {
          await write(originals.map((item, index) => ({
            ...item,
            category: updates[index].category,
            properties: { ...updates[index].properties },
          })));
        },
        async undo() { await write(originals); },
        isCombinable() { return false; },
        combine(previous: ICommandAction) { return previous; },
      };
    },
  });
}
