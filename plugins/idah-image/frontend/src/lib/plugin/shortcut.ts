// import { BuildKeymap, KeyMapBuilder } from "$idah/shortcut/key-map-builder";
import { BuildKeymap, type KeyMapBuilder } from "$lib/shortcut/key-map-builder";

import { ShortcutManager } from "$lib/shortcut/shortcut-manager";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_NOTE, IMAGE_POLYGON } from "./types";

import type { ICommands } from "$lib/context/context";

// Mode-related shortcut context
type KeyMapContext = {
  commands: ICommands;
  toggleCommandCB: () => void;
  flush: () => void;
  switch_mode: (mode: string) => void;
  // zoom: { in: () => void; out: () => void };
};

// Selection-specific shortcut context
type SelectionKeyMapContext = {
  commands: ICommands;
  selectedId: string | undefined;
  selectedGroupId: string;
  getCurrentFrame: () => number;
};

const injectCommonShortcuts = (context: KeyMapContext) => {
  const flushAction = () => {
    context.flush();
  };
  const redoAction = () => {
    context.commands.redo();
  };
  const undoAction = () => {
    context.commands.undo();
  };
  const toggleCommand = () => {
    context.toggleCommandCB();
  };

  const enterMode = (mode: string, replace: boolean = false) => {
    return () => {
      ShortcutManager.enterMode(mode, replace);
      context.switch_mode(mode);
    };
  };

  const resetMode = () => {
    context.commands.run("tools.reset");
    ShortcutManager.enterMode(ShortcutManager.defaultMode, true);
    context.switch_mode(ShortcutManager.defaultMode);
  };

  return (b: KeyMapBuilder) => {
    b.on([b.Alt], "S", flushAction, "Flush", "flush action");
    b.on([b.Ctrl], "Space", toggleCommand, "Commands Dialog", "Toggle this commands dialog");
    b.on([b.Ctrl], "Z", undoAction, "Undo", "Undo last action");
    b.on([b.Ctrl, b.Shift], "Z", redoAction, "Redo", "Redo last undone action if any");

    // modes
    b.on(null, "D", enterMode(ShortcutManager.defaultMode, true), "Default View", "Default View");
    b.on(null, "Escape", resetMode, "Reset View", "Reset View");
    b.on(null, "B", enterMode(IMAGE_BOUNDING_BOX), "Bounding box", "Enter Bounding box mode");
    b.on(null, "P", enterMode(IMAGE_POLYGON), "Polygon", "Enter Polygon mode");
    b.on(null, "N", enterMode(IMAGE_NOTE), "Note", "Enter Note mode");
  };
};

// TODO: review this mode's shortcuts
const buildBoundingBoxModeShortcuts = (context: KeyMapContext) => {
  const backAction = () => {
    ShortcutManager.leaveMode();
    context.switch_mode(ShortcutManager.getCurrentMode());
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Backspace", backAction, "back", "back action");
  };
};

const buildNoteModeShortcuts = (context: KeyMapContext) => {
  return (b: KeyMapBuilder) => {
    // No specific shortcuts for note mode yet
  };
};

// Add mode and shortcut definitions here.
const MODE_BUILDERS: Record<string, (context: KeyMapContext) => (b: KeyMapBuilder) => void> = {
  [IMAGE_BOUNDING_BOX]: buildBoundingBoxModeShortcuts,
  [IMAGE_NOTE]: buildNoteModeShortcuts,
};

/**
 * Register mode/editor shortcuts.
 * Call this on mount.
 */
export function registerShortcuts(context: KeyMapContext) {
  Object.entries(MODE_BUILDERS).forEach(([mode, buildFn]) => {
    const keyMap = BuildKeymap((b) => {
      injectCommonShortcuts(context)(b);
      buildFn(context)(b);
    });
    ShortcutManager.registerKeyMap(mode, keyMap);
  });

  // set and enter default mode
  ShortcutManager.defaultMode = DEFAULT_MODE;
  ShortcutManager.enterMode(DEFAULT_MODE);
  context.switch_mode(DEFAULT_MODE);

  return ShortcutManager.getEffectiveKeyMap(DEFAULT_MODE);
}

const buildOnSelectBoundingBoxModeShortcuts = (context: SelectionKeyMapContext) => {
  const deleteSelected = () => {
    if (context.selectedId) {
      context.commands.run("annotation.delete", { annotationId: context.selectedId });
    } else if (context.selectedGroupId) {
      context.commands.run("annotation.deleteGroup", { groupId: context.selectedGroupId });
    } else {
      return;
    }
  };

  const toggleGroupVisibility = () => {
    if (!context.selectedGroupId) return;

    context.commands.run("annotation.toggleGroupVisibility", { groupId: context.selectedGroupId });
  };

  const toggleGroupEditability = () => {
    if (!context.selectedGroupId) return;

    context.commands.run("annotation.toggleGroupEditability", { groupId: context.selectedGroupId });
  };

  const splitAnnotation = () => {
    if (!context.selectedId) return;

    const currentFrame = context.getCurrentFrame();
    context.commands.run("annotation.split", { id: context.selectedId, at: currentFrame });
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "Delete", "Delete selected annotation");
    b.on(null, "H", toggleGroupVisibility, "Toggle Group Visibility", "Hide/Show selected annotation group");
    b.on(null, "L", toggleGroupEditability, "Toggle Group Editability", "Lock/Unlock selected annotation group");
    b.on(null, "S", splitAnnotation, "Split", "Split selected annotation at selected frame");
  };
};

const buildOnSelectPolygonModeShortcuts = (context: SelectionKeyMapContext) => {
  const deleteSelected = () => {
    if (context.selectedId) {
      context.commands.run("annotation.delete", { annotationId: context.selectedId });
    } else if (context.selectedGroupId) {
      context.commands.run("annotation.deleteGroup", { groupId: context.selectedGroupId });
    } else {
      return;
    }
  };

  const toggleGroupVisibility = () => {
    if (!context.selectedGroupId) return;

    context.commands.run("annotation.toggleGroupVisibility", { groupId: context.selectedGroupId });
  };

  const toggleGroupEditability = () => {
    if (!context.selectedGroupId) return;

    context.commands.run("annotation.toggleGroupEditability", { groupId: context.selectedGroupId });
  };

  const splitAnnotation = () => {
    if (!context.selectedId) return;

    const currentFrame = context.getCurrentFrame();
    context.commands.run("annotation.split", { id: context.selectedId, at: currentFrame });
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "Delete", "Delete selected annotation");
    b.on(null, "H", toggleGroupVisibility, "Toggle Group Visibility", "Hide/Show selected annotation group");
    b.on(null, "L", toggleGroupEditability, "Toggle Group Editability", "Lock/Unlock selected annotation group");
    b.on(null, "S", splitAnnotation, "Split", "Split selected annotation at selected frame");
  };
};

// Add mode and shortcut definitions for selected annotation/object here.
const SELECTION_MODE_BUILDERS: Record<string, (context: SelectionKeyMapContext) => (b: KeyMapBuilder) => void> = {
  [IMAGE_BOUNDING_BOX]: buildOnSelectBoundingBoxModeShortcuts,
  [IMAGE_POLYGON]: buildOnSelectPolygonModeShortcuts,
};

/**
 * Register selection-specific shortcuts as extension layer.
 * Call this when an annotation/object is selected.
 */
export function registerOnSelectShortcuts(mode: string, context: SelectionKeyMapContext) {
  const buildFn = SELECTION_MODE_BUILDERS[mode];
  if (!buildFn) return;

  // clear any existing extensions first, this can be tinker to allow multiple extension layers
  ShortcutManager.clearAllKeyMapExtensions();

  // create and register new extension for the current mode
  const selectionKeyMap = BuildKeymap(buildFn(context));
  ShortcutManager.setKeyMapExtension(mode, selectionKeyMap);
  ShortcutManager.enterMode(mode);
}
