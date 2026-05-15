import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import { getDriver } from "$lib/state/driver.svelte";

import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { IVideoAnnotationRecord } from "$lib/types";

export function getGroupContextMenus(props: { items: IVideoAnnotationRecord[]; category: string }): Menus {
  const { items, category } = props;
  const isSomeHidden = items.every((item) => item.hidden && item.value?.category === category);
  const isSomeLocked = items.every((item) => item.locked && item.value?.category === category);

  return {
    actions: {
      items: {
        visibility: {
          label: isSomeHidden ? "Show Category Annotations" : "Hide Category Annotations",
          icon: isSomeHidden ? EyeIcon : EyeOffIcon,
          alwaysShow: isSomeHidden,
          onClick: () => getDriver().command.call("annotation.toggle_category_visibility", { category }),
        },
        editability: {
          label: isSomeLocked ? "Unlock Category Annotations" : "Lock Category Annotations",
          icon: isSomeLocked ? LockOpenIcon : LockIcon,
          alwaysShow: isSomeLocked,
          onClick: () => getDriver().command.call("annotation.toggle_category_editability", { category }),
        },
        delete: {
          label: "Delete Category Annotations",
          icon: Trash2Icon,
          destructive: true,
          onClick: () => getDriver().command.call("annotation.delete_category", { category }),
        },
      },
    },
  };
}
