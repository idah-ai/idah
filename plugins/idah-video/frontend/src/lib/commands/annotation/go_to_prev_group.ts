// ---------------------------------------------------------------------------
// annotation.go_to_prev_group — Select the previous group in the timeline
//
// Shortcut: Control+ArrowUp
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { getSortedGroupIds } from "$lib/utils/annotation";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

export const command = {
  name: "annotation.go_to_prev_group",
  group: "Annotation",
  modes: ["editor"],
  shortcut: "Control+ArrowUp",
  shortDescription: "Previous group",
  longDescription: "Select the previous group in the timeline",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (): ICommandAction => {
      const sel = selection.value;
      const groups = getSortedGroupIds();
      if (groups.length === 0) {
        return {
          command: command as any,
          do() {},
          isCombinable() { return false; },
          combine(p: any) { return p; },
        };
      }

      let currentIdx = groups.length - 1;
      if (sel?.type === "group") {
        currentIdx = groups.indexOf(sel.groupId);
      } else if (sel?.type === "annotation") {
        const gid = (sel.annotation as any).metadata?.group_id ?? sel.annotation.id;
        currentIdx = groups.indexOf(gid);
      }

      const prevIdx = currentIdx - 1 >= 0 ? currentIdx - 1 : groups.length - 1;
      const targetId = groups[prevIdx];

      return {
        command: command as any,
        do() {
          selection.selectGroup(targetId);
        },
        isCombinable() { return false; },
        combine(p: any) { return p; },
      };
    },
    group: command.group,
  });
}
