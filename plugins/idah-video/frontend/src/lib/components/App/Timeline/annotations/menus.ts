import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import type { IActivityContext } from "$idah/context/activity-context";
import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";

export function getGroupContextMenus(props: { context: IActivityContext; track: TrackData }): Menus {
  const { context, track } = props;
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
            context.commands!.run("annotation.toggleGroupVisibility", { groupId: track.id });
          },
        },
        editability: {
          label: isSomeLocked ? "Unlock Group" : "Lock Group",
          icon: isSomeLocked ? LockOpenIcon : LockIcon,
          alwaysShow: isSomeLocked,
          onClick: () => {
            context.commands!.run("annotation.toggleGroupEditability", { groupId: track.id });
          },
        },
        delete: {
          label: "Delete group",
          icon: Trash2Icon,
          destructive: true,
          onClick: () => {
            context.commands!.run("annotation.deleteGroup", { groupId: track.id });
          },
        },
      },
    },
  };
}
