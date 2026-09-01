// ---------------------------------------------------------------------------
// idah-video:sidebar-tab.* — Jump to a right-sidebar tab via keyboard shortcut.

// These are pure UI-navigation commands: they switch the active tab without
// touching any annotation data, so they intentionally have NO `undo` method —
// the command manager only pushes to the undo stack when an action has an
// `undo`, keeping these out of history.
//
// Any tab change returns to the default (editor) mode via the existing
// core:mode.exit command. The Tagging commands also select the appropriate tagging
// annotation when one exists (entry:root for Video, idah-video:frame for the
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

function findCurrentFrameTagging(): IVideoAnnotationRecord | undefined {
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

export const taggingCommand = {
  name: "idah-video:sidebar-tab.tagging",
  group: "UI",
  modes: ["*"],
  shortcut: "T",
  shortDescription: "Tagging tab",
  longDescription: "Jump to the Tagging tab in the right sidebar",
};

export const videoCommand = {
  name: "idah-video:sidebar-tab.video",
  group: "UI",
  modes: ["*"],
  shortcut: "V",
  shortDescription: "Tagging > Video tab",
  longDescription: "Jump to the Video sub-tab in the Tagging tab",
};

export const frameCommand = {
  name: "idah-video:sidebar-tab.frame",
  group: "UI",
  modes: ["*"],
  shortcut: "F",
  shortDescription: "Tagging > Frame tab",
  longDescription: "Jump to the Frame sub-tab in the Tagging tab",
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
    name: taggingCommand.name,
    modes: taggingCommand.modes,
    shortcut: taggingCommand.shortcut,
    shortDescription: taggingCommand.shortDescription,
    longDescription: taggingCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      // Select the appropriate tagging annotation if one exists, else deselect.

      const entryRoot = findEntryRoot();
      const frameTagging = findCurrentFrameTagging();
      if (entryRoot) {
        selection.selectAnnotation(entryRoot as any);
        sidebarTabs.rightTab = "tagging";
        sidebarTabs.taggingTab = "entry";
      } else if (frameTagging) {
        selection.selectAnnotation(frameTagging as any);
        sidebarTabs.rightTab = "tagging";
        sidebarTabs.taggingTab = "frame";
      } else {
        selection.deselect();
        sidebarTabs.rightTab = "tagging";
      }
      return noopAction(taggingCommand);
    },
    group: taggingCommand.group,
  });

  driver.command.register({
    name: videoCommand.name,
    modes: videoCommand.modes,
    shortcut: videoCommand.shortcut,
    shortDescription: videoCommand.shortDescription,
    longDescription: videoCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      const entryRoot = findEntryRoot();
      if (entryRoot) selection.selectAnnotation(entryRoot as any);
      else selection.deselect();
      sidebarTabs.rightTab = "tagging";
      sidebarTabs.taggingTab = "entry";
      return noopAction(videoCommand);
    },
    group: videoCommand.group,
  });

  driver.command.register({
    name: frameCommand.name,
    modes: frameCommand.modes,
    shortcut: frameCommand.shortcut,
    shortDescription: frameCommand.shortDescription,
    longDescription: frameCommand.longDescription,
    callback: (): ICommandAction => {
      exitToDefaultMode(driver);
      const frameTagging = findCurrentFrameTagging();
      if (frameTagging) selection.selectAnnotation(frameTagging as any);
      else selection.deselect();
      sidebarTabs.rightTab = "tagging";
      sidebarTabs.taggingTab = "frame";
      return noopAction(frameCommand);
    },
    group: frameCommand.group,
  });
}