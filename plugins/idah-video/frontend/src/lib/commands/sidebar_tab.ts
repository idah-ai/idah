// ---------------------------------------------------------------------------
// idah-video:sidebar-tab.* — Jump to a right-sidebar tab via keyboard shortcut.
//
// These are pure UI-navigation commands: they switch the active tab without
// touching any annotation data, so they intentionally have NO `undo` method —
// the command manager only pushes to the undo stack when an action has an
// `undo`, keeping these out of history.
//
// Any tab change returns to the default (editor) mode via the existing
// core:mode.exit command. The Meta commands also select the appropriate meta
// annotation when one exists (entry:root for Entry, idah-video:frame for the
// current frame for Frame), otherwise they deselect. Both the tab clicks and
// the shortcuts route through these commands so the behavior stays uniform.
// ---------------------------------------------------------------------------
import { sidebarTabs } from "$lib/state/sidebar-tabs.svelte";
import { selection } from "$lib/state/selection.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { data } from "$lib/state/data.svelte";
import { ENTRY_ROOT, VIDEO_FRAME, type IVideoAnnotationRecord } from "$lib/types";
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

function findEntryRoot(): IVideoAnnotationRecord | undefined {
  return (data.annotations?.items ?? []).find((a) => (a.shape as { type?: string })?.type === ENTRY_ROOT) as
    | IVideoAnnotationRecord
    | undefined;
}

function findCurrentFrameMeta(): IVideoAnnotationRecord | undefined {
  const frame = viewport.video.currentFrame.value;
  return (data.annotations?.items ?? []).find(
    (a) =>
      (a.shape as { type?: string })?.type === VIDEO_FRAME &&
      (a.shape as { start?: number }).start === frame &&
      (a.shape as { end?: number }).end === frame,
  ) as IVideoAnnotationRecord | undefined;
}

export const selectionCommand = {
  name: "idah-video:sidebar-tab.selection",
  group: "UI",
  modes: ["*"],
  shortcut: "A",
  shortDescription: "Annotations tab",
  longDescription: "Jump to the Annotations tab in the right sidebar",
};

export const metaCommand = {
  name: "idah-video:sidebar-tab.meta",
  group: "UI",
  modes: ["*"],
  shortcut: "M",
  shortDescription: "Meta tab",
  longDescription: "Jump to the Meta tab in the right sidebar",
};

export const entryCommand = {
  name: "idah-video:sidebar-tab.entry",
  group: "UI",
  modes: ["*"],
  shortcut: "E",
  shortDescription: "Meta > Entry tab",
  longDescription: "Jump to the Entry sub-tab in the Meta tab",
};

export const frameCommand = {
  name: "idah-video:sidebar-tab.frame",
  group: "UI",
  modes: ["*"],
  shortcut: "F",
  shortDescription: "Meta > Frame tab",
  longDescription: "Jump to the Frame sub-tab in the Meta tab",
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
      // Select the appropriate meta annotation if one exists, else deselect.
      const entryRoot = findEntryRoot();
      const frameMeta = findCurrentFrameMeta();
      if (entryRoot) {
        selection.selectAnnotation(entryRoot as any);
        sidebarTabs.rightTab = "meta";
        sidebarTabs.metaTab = "entry";
      } else if (frameMeta) {
        selection.selectAnnotation(frameMeta as any);
        sidebarTabs.rightTab = "meta";
        sidebarTabs.metaTab = "frame";
      } else {
        selection.deselect();
        sidebarTabs.rightTab = "meta";
      }
      return noopAction(metaCommand);
    },
    group: metaCommand.group,
  });

  driver.command.register({
    name: entryCommand.name,
    modes: entryCommand.modes,
    shortcut: entryCommand.shortcut,
    shortDescription: entryCommand.shortDescription,
    longDescription: entryCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      const entryRoot = findEntryRoot();
      if (entryRoot) selection.selectAnnotation(entryRoot as any);
      else selection.deselect();
      sidebarTabs.rightTab = "meta";
      sidebarTabs.metaTab = "entry";
      return noopAction(entryCommand);
    },
    group: entryCommand.group,
  });

  driver.command.register({
    name: frameCommand.name,
    modes: frameCommand.modes,
    shortcut: frameCommand.shortcut,
    shortDescription: frameCommand.shortDescription,
    longDescription: frameCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      const frameMeta = findCurrentFrameMeta();
      if (frameMeta) selection.selectAnnotation(frameMeta as any);
      else selection.deselect();
      sidebarTabs.rightTab = "meta";
      sidebarTabs.metaTab = "frame";
      return noopAction(frameCommand);
    },
    group: frameCommand.group,
  });
}