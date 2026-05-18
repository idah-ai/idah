import { CrosshairIcon, EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import { annotation } from "$lib/state/annotation.svelte";
import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";
import { getDriver } from "$lib/state/driver.svelte";
import { selection } from "$lib/state/selection.svelte";

export function getGroupContextMenus(props: { track: TrackData }): Menus {
  const { track } = props;
  const isSomeHidden = track.items.some((item) => annotation.isHidden(item.rawData.id));
  const isSomeLocked = track.items.some((item) => annotation.isLocked(item.rawData.id));

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
          onClick: () =>
            getDriver().command.call("annotation.delete_group", {
              groupId: track.id,
              annotations: track.items.map((item) => item.rawData),
            }),
        },
      },
    },
  };
}
