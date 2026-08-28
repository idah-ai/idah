// ---------------------------------------------------------------------------
// idah-image:sidebar-tab.* — Jump to a right-sidebar tab via keyboard shortcut.
//
// These are pure UI-navigation commands: they switch the active tab without
// touching any annotation data, so they intentionally have NO `undo` method —
// the command manager only pushes to the undo stack when an action has an
// `undo`, keeping these out of history.
//
// Any tab change returns to the default (editor) mode via the existing
// core:mode.exit command. The Meta command also selects the entry:root
// annotation when one exists, otherwise it deselects. Both the tab clicks and
// the shortcuts route through these commands so the behavior stays uniform.
// ---------------------------------------------------------------------------
import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";
import { selection } from "$lib/state/selection.svelte";
import { data } from "$lib/state/data.svelte";
import { ENTRY_ROOT, type IImageAnnotationRecord } from "$lib/types";
import type { IIdahDriverV2, ICommandAction } from "$idah/v2/types";

function noopAction(command: { name: string }): ICommandAction {
  return {
    command: command as any,
    do() {},
    isCombinable() {
      return false;
    },
    combine(p: any) {
      return p;
    },
  };
}

// Return to the default (editor) mode via the existing core:mode.exit command.
function exitToDefaultMode(driver: IIdahDriverV2) {
  driver.command.call("core:mode.exit");
}

function findEntryRoot(): IImageAnnotationRecord | undefined {
  return (data.annotations?.items ?? []).find((a) => (a.shape as { type?: string })?.type === ENTRY_ROOT) as
    | IImageAnnotationRecord
    | undefined;
}

export const selectionCommand = {
  name: "idah-image:sidebar-tab.selection",
  group: "UI",
  modes: ["*"],
  shortcut: "A",
  shortDescription: "Annotations tab",
  longDescription: "Jump to the Annotations tab in the right sidebar",
};

export const metaCommand = {
  name: "idah-image:sidebar-tab.meta",
  group: "UI",
  modes: ["*"],
  shortcut: "M",
  shortDescription: "Meta tab",
  longDescription: "Jump to the Meta tab in the right sidebar",
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: selectionCommand.name,
    modes: selectionCommand.modes,
    shortcut: selectionCommand.shortcut,
    shortDescription: selectionCommand.shortDescription,
    longDescription: selectionCommand.longDescription,
    callback: (): ICommandAction => {
      selection.deselect();
      exitToDefaultMode(driver);
      sidebarTabs.rightTab = "annotations";
      return noopAction(selectionCommand);
    },
    group: selectionCommand.group,
  });

  driver.command.register({
    name: metaCommand.name,
    modes: metaCommand.modes,
    shortcut: metaCommand.shortcut,
    shortDescription: metaCommand.shortDescription,
    longDescription: metaCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      // Select the entry:root annotation if one exists, else deselect.
      const entryRoot = findEntryRoot();
      if (entryRoot) selection.selectAnnotation(entryRoot as any);
      else selection.deselect();
      sidebarTabs.rightTab = "meta";
      return noopAction(metaCommand);
    },
    group: metaCommand.group,
  });
}