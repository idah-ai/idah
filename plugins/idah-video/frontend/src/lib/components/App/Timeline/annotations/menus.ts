import { CrosshairIcon, EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import { getDriver } from "$lib/state/driver.svelte";
import { selection } from "$lib/state/selection.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { confirmAnnotationsDelete } from "$lib/components/App/ConfirmDialog/confirm-delete";

import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";

export function getGroupContextMenus(props: { track: TrackData }): Menus {
  const { track } = props;
  const isSomeHidden = track.items.some((item) => annotation.isHidden(item.rawData));
  const isSomeLocked = track.items.some((item) => annotation.isLocked(item.rawData));
  const tracksShapeType = track.items[0].rawData.shape_type.split(":")[1];

  return {
    actions: {
      items: {
        focus: {
          label: "Focus",
          icon: CrosshairIcon,
          onClick: () => {
            selection.selectGroup(track.id);
            getDriver().command.call("idah-video:timeline.focus");
          },
        },
        visibility: {
          label: "Show/Hide Group",
          icon: isSomeHidden ? EyeOffIcon : EyeIcon,
          alwaysShow: isSomeHidden,
          onClick: (e: MouseEvent) => {
            if (e.shiftKey) {
              getDriver().command.call("idah-video:annotation.group.toggle-visibility-solo", { groupId: track.id });
            } else {
              getDriver().command.call("idah-video:annotation.group.toggle-visibility", { groupId: track.id });
            }
          },
        },
        editability: {
          label: "Lock/Unlock Group",
          icon: isSomeLocked ? LockIcon : LockOpenIcon,
          alwaysShow: isSomeLocked,
          onClick: () => getDriver().command.call("idah-video:annotation.group.toggle-editability", { groupId: track.id }),
        },
        delete: {
          label: "Delete group",
          icon: Trash2Icon,
          destructive: true,
          disabled: !isEditable() || isSomeLocked || viewport.isReviewWorkspace,
          onClick: () => {
            confirmAnnotationsDelete({
              count: track.items.length,
              title: "Delete annotation group",
              description: `Are you sure you want to delete this ${tracksShapeType} annotation group ("${track.title}")?`,
              onConfirm: () => {
                selection.selectGroup(track.id);
                // This menu already confirmed — tell the gated selection.delete
                // command to skip its own dialog (single confirmation).
                getDriver().command.call("idah-video:selection.delete", {
                  skipConfirm: true,
                  groupId: track.id,
                  annotations: track.items.map((item) => item.rawData),
                });
              },
            });
          },
        },
      },
    },
  };
}
