// ---------------------------------------------------------------------------
// annotation.go_to_next_group — Select the next group in the timeline
//
// Shortcut: Control+ArrowDown
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { getSortedGroupIds } from "$lib/utils/annotation";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

export const command = {
  name: "annotation.go_to_next_group",
  group: "Annotation",
  modes: ["default", "review"],
  shortcut: "Control+ArrowDown",
  shortDescription: "Next group",
  longDescription: "Select the next group in the timeline",
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

      let currentIdx = -1;
      if (sel?.type === "group") {
        currentIdx = groups.indexOf(sel.groupId);
      } else if (sel?.type === "annotation") {
        const gid = (sel.annotation as any).metadata?.group_id ?? sel.annotation.id;
        currentIdx = groups.indexOf(gid);
      }

      const nextIdx = currentIdx + 1 < groups.length ? currentIdx + 1 : 0;
      const targetId = groups[nextIdx];

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
