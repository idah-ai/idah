import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";
import { getDriver } from "$lib/state/driver.svelte";

export function getGroupContextMenus(props: { track: TrackData }): Menus {
  const { track } = props;
  const isSomeHidden = track.items.some((item) => item.rawData.hidden);
  const isSomeLocked = track.items.some((item) => item.rawData.locked);

  return {
    actions: {
      items: {
        visibility: {
          label: isSomeHidden ? "Show Group" : "Hide Group",
          icon: isSomeHidden ? EyeIcon : EyeOffIcon,
          alwaysShow: isSomeHidden,
          onClick: () => {
            getDriver().command.call("annotation.toggleGroupVisibility", { groupId: track.id });
          },
        },
        editability: {
          label: isSomeLocked ? "Unlock Group" : "Lock Group",
          icon: isSomeLocked ? LockOpenIcon : LockIcon,
          alwaysShow: isSomeLocked,
          onClick: () => {
            getDriver().command.call("annotation.toggleGroupEditability", { groupId: track.id });
          },
        },
        delete: {
          label: "Delete group",
          icon: Trash2Icon,
          destructive: true,
          onClick: () => {
            getDriver().command.call("annotation.deleteGroup", { groupId: track.id });
          },
        },
      },
    },
  };
}
