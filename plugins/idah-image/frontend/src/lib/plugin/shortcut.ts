import { BuildKeymap, KeyMapBuilder } from "$lib/shortcut/key-map-builder";

import { ShortcutManager } from "$lib/shortcut/shortcut-manager.svelte";

import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_NOTE, IMAGE_POLYGON, IMAGE_VISUAL } from "$lib/plugin/types";
import { setCurrentModeTo } from "$lib/plugin/store/store";

import type { IActivityContext, ICommands } from "$lib/context/context";

// Mode-related shortcut context
type KeyMapContext = {
  commands: ICommands;
  flush: () => void;
  switch_mode: (mode: string) => void;
  zoom: { in: () => void; out: () => void };
};

// Selection-specific shortcut context
type SelectionKeyMapContext = {
  commands: ICommands;
  selectedId: string | undefined;
  selectedGroupId: string;
};

const injectCommonShortcuts = (context: KeyMapContext) => {
  const flushAction = () => {
    context.flush();
  };
  const redoAction = () => {
    context.commands.redo();
    setCurrentModeTo(IMAGE_VISUAL)
  };
  const undoAction = () => {
    context.commands.undo();
    setCurrentModeTo(IMAGE_VISUAL);
  };
  const toggleCommand = () => {
    context.commands.run("command_dialog");
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
    b.on([b.Alt], "S", flushAction, "flush", "Flush", "flush action");
    b.on(
      [b.Ctrl],
      "Space",
      toggleCommand,
      "command_dialog",
      "Toggle Command Shortcuts List",
      "Toggle this commands dialog",
    );
    b.on([b.Ctrl], "Z", undoAction, "undo", "Undo Action", "Undo last action");
    b.on([b.Ctrl, b.Shift], "Z", redoAction, "redo", "Redo Action", "Redo last undone action if any");

    // modes
    b.on(null, "D", enterMode(ShortcutManager.defaultMode, true), "tools.visual", "Default View", "Default View");
    b.on(
      null,
      "B",
      enterMode(IMAGE_BOUNDING_BOX),
      "tools.bounding_box",
      "Bounding Box mode",
      "Enter Bounding box mode",
    );
    b.on(null, "P", enterMode(IMAGE_POLYGON), "tools.polygon", "Polygon mode", "Enter Polygon mode");
    b.on(null, "N", enterMode(IMAGE_NOTE), "tools.note", "Note mode", "Enter Note mode");
    b.on(null, "Escape", resetMode, "reset_view", "Reset View", "Reset View");
  };
};

const buildVisualModeShortcuts = (context: KeyMapContext) => {
  return (b: KeyMapBuilder) => {
    // TODO: test, need uniform way to map accross keyboards (-/+)
    b.on(null, "Equal",() => context.zoom.in(), "zoom_in", "Zoom In", "Zoom In");
    b.on(null, "Minus", () => context.zoom.out(), "zoom_out", "Zoom Out", "Zoom Out");
  };
};

// TODO: review this mode's shortcuts
const buildBoundingBoxModeShortcuts = (context: KeyMapContext) => {
  const backAction = () => {
    ShortcutManager.leaveMode();
    context.switch_mode(ShortcutManager.getCurrentMode());
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Backspace", backAction, "back", "Back", "Go Back");
  };
};

// TODO: review this mode's shortcuts
const buildPolygonModeShortcuts = (context: KeyMapContext) => {
  const backAction = () => {
    ShortcutManager.leaveMode();
    context.switch_mode(ShortcutManager.getCurrentMode());
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Backspace", backAction, "back", "Back", "Go Back");
  };
};

const buildNoteModeShortcuts = (context: KeyMapContext) => {
  return (b: KeyMapBuilder) => {
    // No specific shortcuts for note mode yet
  };
};

// Add mode and shortcut definitions here.
const MODE_BUILDERS: Record<string, (context: KeyMapContext) => (b: KeyMapBuilder) => void> = {
  [IMAGE_VISUAL]: buildVisualModeShortcuts,
  [IMAGE_BOUNDING_BOX]: buildBoundingBoxModeShortcuts,
  [IMAGE_POLYGON]: buildPolygonModeShortcuts,
  [IMAGE_NOTE]: buildNoteModeShortcuts,
};

/**
 * Register shortcut references for all possible commands.
 * Call this on mount to populate the reference list cleanly without side effects.
 *
 * A no-op context (`{} as any`) is used because the builder functions only store
 * action closures — they never call them — so no real context is needed.
 */
export function registerShortcutsReference(context: IActivityContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = {} as any;

  const allRefs: Record<string, { label: string; description: string; keyCombinations: string[] }> = {};

  const processKeyMap = (keyMap: Record<string, any>) => {
    Object.entries(keyMap).forEach(([keyCombination, value]) => {
      if (!allRefs[value.name]) {
        allRefs[value.name] = { label: value.label, description: value.description, keyCombinations: [keyCombination] };
      } else if (!allRefs[value.name].keyCombinations.includes(keyCombination)) {
        allRefs[value.name].keyCombinations.push(keyCombination);
      }
    });
  };

  // Collect from base modes (common shortcuts injected alongside each mode)
  Object.values(MODE_BUILDERS).forEach((buildFn) => {
    processKeyMap(
      BuildKeymap((b) => {
        injectCommonShortcuts(ctx)(b);
        buildFn(ctx)(b);
      }),
    );
  });

  // Collect from selection modes
  Object.values(SELECTION_MODE_BUILDERS).forEach((buildFn) => {
    processKeyMap(BuildKeymap(buildFn(ctx)));
  });

  context.registerShortcutReferences(allRefs);
}

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

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "selected.delete", "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "selected.delete", "Delete", "Delete selected annotation");
    b.on(
      null,
      "H",
      toggleGroupVisibility,
      "selected.toggle_group_visibility",
      "Toggle Group Visibility",
      "Hide/Show selected annotation group",
    );
    b.on(
      null,
      "L",
      toggleGroupEditability,
      "selected.toggle_group_editability",
      "Toggle Group Editability",
      "Lock/Unlock selected annotation group",
    );
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

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "selected.delete", "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "selected.delete", "Delete", "Delete selected annotation");
    b.on(
      null,
      "H",
      toggleGroupVisibility,
      "selected.toggle_group_visibility",
      "Toggle Group Visibility",
      "Hide/Show selected annotation group",
    );
    b.on(
      null,
      "L",
      toggleGroupEditability,
      "selected.toggle_group_editability",
      "Toggle Group Editability",
      "Lock/Unlock selected annotation group",
    );
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
