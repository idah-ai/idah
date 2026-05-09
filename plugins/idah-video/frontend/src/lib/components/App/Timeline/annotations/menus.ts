import { CrosshairIcon, EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, Trash2Icon } from "@lucide/svelte";

import type { Menus } from "$lib/components/App/ContextMenu/types";
import type { TrackData } from "$lib/components/App/Timeline/types";
import { getDriver } from "$lib/state/driver.svelte";
import { viewport } from "$lib/state/viewport.svelte";

export function getGroupContextMenus(props: { track: TrackData }): Menus {
  const { track } = props;
  const isSomeHidden = track.items.some((item) => item.rawData.hidden);
  const isSomeLocked = track.items.some((item) => item.rawData.locked);

  // Compute the overall range for focus: from first annotation start to last annotation end
  const firstItem = track.items[0];
  const lastItem = track.items[track.items.length - 1];

  function focusOnGroup() {
    if (!firstItem) return;
    const start = firstItem.startRange;
    const end = lastItem?.endRange ?? firstItem.endRange;
    const margin = Math.max(10, Math.round((end - start) * 0.1));
    viewport.timeline.range = {
      startRange: Math.max(0, start - margin),
      endRange: Math.min(end + margin, viewport.timeline.range.endRange + (end - start)),
    };
  }

  return {
    actions: {
      items: {
        focus: {
          label: "Focus",
          icon: CrosshairIcon,
          onClick: focusOnGroup,
        },
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
