import { CrosshairIcon, EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { selection } from "$lib/state/selection.svelte";
import { showConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";

import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";

export function getGroupContextMenus(props: { track: TrackData }): Menus {
  const { track } = props;
  const isSomeHidden = track.items.some((item) => annotation.isHidden(item.rawData));
  const isSomeLocked = track.items.some((item) => annotation.isLocked(item.rawData));

  return {
    actions: {
      items: {
        focus: {
          label: "Focus",
          icon: CrosshairIcon,
          onClick: () => {
            selection.selectGroup(track.id);
            getDriver().command.call("timeline.focus");
          },
        },
        visibility: {
          label: "Show/Hide Group",
          icon: isSomeHidden ? EyeOffIcon : EyeIcon,
          alwaysShow: isSomeHidden,
          onClick: () => getDriver().command.call("annotation.toggle_group_visibility", { groupId: track.id }),
        },
        editability: {
          label: "Lock/Unlock Group",
          icon: isSomeLocked ? LockIcon : LockOpenIcon,
          alwaysShow: isSomeLocked,
          onClick: () => getDriver().command.call("annotation.toggle_group_editability", { groupId: track.id }),
        },
        delete: {
          label: "Delete group",
          icon: Trash2Icon,
          destructive: true,
          onClick: () => {
            showConfirmDialog({
              title: "Delete annotation group",
              description: "Are you sure you want to delete this annotation group?",
              onConfirm: () => {
                selection.selectGroup(track.id);
                getDriver().command.call("selection.delete", {
                  groupId: track.id,
                  annotations: track.items.map((item) => item.rawData),
                });
              }
            })
          }
        },
      },
    },
  };
}
