import { KeyMapBuilder, BuildKeymap } from "$idah/shortcut/key-map-builder";
import { ShortcutManager } from "$idah/shortcut/shortcut-manager";

import { DEFAULT_MODE, IDAH_VISUAL, IDAH_VIDEO_POLYGON, IDAH_VIDEO_BOUNDING_BOX, IDAH_NOTE, IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP } from "$lib/plugin/type";

import type { IActivityContext, ICommands } from "$idah/context/activity-context";
import type Video from "$lib/plugin/video-annotation-activity/video/video.svelte";

// Mode-related shortcut context
type KeyMapContext = {
  commands: ICommands;
  player: () => Video | undefined;
  toggleCommandCB: () => void;
  flush: () => void;
  switch_mode: (mode: string) => void;
  zoom: { in: () => void; out: () => void };
};

// Selection-specific shortcut context
type SelectionKeyMapContext = {
  commands: ICommands;
  selectedId: string | undefined;
  selectedGroupId: string;
  getCurrentFrame: () => number;
};

const injectCommonShortcuts = (context: KeyMapContext) => {
  const flushAction = () => { context.flush(); };
  const redoAction = () => { context.commands.redo(); };
  const undoAction = () => { context.commands.undo(); };
  const toggleCommand = () => { context.toggleCommandCB(); };

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
    b.on(null, "B", enterMode(IDAH_VIDEO_BOUNDING_BOX), "Bounding box", "Enter Bounding box mode");
    b.on(null, "P", enterMode(IDAH_VIDEO_POLYGON), "Polygon", "Enter Polygon mode");
    b.on(null, "N", enterMode(IDAH_NOTE), "Note", "Enter Note mode");
  };
};

const buildVisualModeShortcuts = (context: KeyMapContext) => {
  const togglePlay = () => { context.player()?.togglePlay(); };
  const nextFrame = () => { context.player()?.nextFrame(); };
  const previousFrame = () => { context.player()?.previousFrame(); };

  const defaultFrameStep = 10;

  const nextMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || defaultFrameStep;
    context.player()?.nextFrame(frameStep);
  };

  const previousMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || defaultFrameStep;
    context.player()?.previousFrame(frameStep);
  };

  const startFrame = () => { context.player()?.seekToFrame(0); };
  const endFrame = () => { context.player()?.seekToFrame(context.player()?.getFrames() || 0); };

  return (b: KeyMapBuilder) => {
    b.on(null, "Space", togglePlay, "Toggle Play", "Play/Pause the video player");
    b.on(null, "ArrowRight", nextFrame, "Next", "go to the next frame");
    b.on(null, "ArrowLeft", previousFrame, "Previous", "go to the previous frame");
    b.on(null, "V", nextMultipleFrames, "Next 10 Frames", "Go to the next 10 frames");
    b.on(null, "C", previousMultipleFrames, "Previous 10 Frames", "Go to the Previous 10 frames");
    b.on([b.Ctrl, b.Alt], "ArrowRight", endFrame, "End", "go to the starting frame");
    b.on([b.Ctrl, b.Alt], "ArrowLeft", startFrame, "Start", "go to the ending frame");

    // TODO: test, need uniform way to map accross keyboards (-/+)
    b.on(null, "Equal", context.zoom.in, "Zoom in", "Zoom In");
    b.on(null, "Minus", context.zoom.out, "Zoom Out", "Zoom Out");
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

const buildPolygonModeShortcuts = (context: KeyMapContext) => {
  const togglePlay = () => { context.player()?.togglePlay(); };
  const nextFrame = () => { context.player()?.nextFrame(); };
  const previousFrame = () => { context.player()?.previousFrame(); };

  const defaultFrameStep = 10;

  const nextMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || defaultFrameStep;
    context.player()?.nextFrame(frameStep);
  };

  const previousMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || defaultFrameStep;
    context.player()?.previousFrame(frameStep);
  };

  const startFrame = () => { context.player()?.seekToFrame(0); };
  const endFrame = () => { context.player()?.seekToFrame(context.player()?.getFrames() || 0); };

  return (b: KeyMapBuilder) => {
    b.on(null, "Space", togglePlay, "Toggle Play", "Play/Pause the video player");
    b.on(null, "ArrowRight", nextFrame, "Next", "go to the next frame");
    b.on(null, "ArrowLeft", previousFrame, "Previous", "go to the previous frame");
    b.on(null, "V", nextMultipleFrames, "Next 10 Frames", "Go to the next 10 frames");
    b.on(null, "C", previousMultipleFrames, "Previous 10 Frames", "Go to the Previous 10 frames");
    b.on([b.Ctrl, b.Alt], "ArrowRight", endFrame, "End", "go to the starting frame");
    b.on([b.Ctrl, b.Alt], "ArrowLeft", startFrame, "Start", "go to the ending frame");

    // TODO: test, need uniform way to map accross keyboards (-/+)
    b.on(null, "Equal", context.zoom.in, "Zoom in", "Zoom In");
    b.on(null, "Minus", context.zoom.out, "Zoom Out", "Zoom Out");
  };
};

const buildNoteModeShortcuts = (context: KeyMapContext) => {
  return (b: KeyMapBuilder) => {
    // No specific shortcuts for note mode yet
  };
};

// Add mode and shortcut definitions here.
const MODE_BUILDERS: Record<string, (context: KeyMapContext) => (b: KeyMapBuilder) => void> = {
  [IDAH_VISUAL]: buildVisualModeShortcuts,
  [IDAH_VIDEO_BOUNDING_BOX]: buildBoundingBoxModeShortcuts,
  [IDAH_VIDEO_POLYGON]: buildPolygonModeShortcuts,
  [IDAH_NOTE]: buildNoteModeShortcuts,
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

  const toggleHidden = () => {
    if (!context.selectedId) return

    context.commands.run("annotation.toggleHidden", { id: context.selectedId });
  };

  const toggleLocked = () => {
    if (!context.selectedId) return

    context.commands.run("annotation.toggleLocked", { id: context.selectedId });
  };

  const splitAnnotation = () => {
    if (!context.selectedId) return

    const currentFrame = context.getCurrentFrame();
    context.commands.run("annotation.split", { id: context.selectedId, at: currentFrame });
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "Delete", "Delete selected annotation");
    b.on(null, "H", toggleHidden, "Toggle Hidden", "Hide/Show selected annotation");
    b.on(null, "L", toggleLocked, "Toggle Locked", "Lock/Unlock selected annotation");
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

  const toggleHidden = () => {
    if (!context.selectedId) return

    context.commands.run("annotation.toggleHidden", { id: context.selectedId });
  };

  const toggleLocked = () => {
    if (!context.selectedId) return

    context.commands.run("annotation.toggleLocked", { id: context.selectedId });
  };

  const splitAnnotation = () => {
    if (!context.selectedId) return
    
    const currentFrame = context.getCurrentFrame();
    context.commands.run("annotation.split", { id: context.selectedId, at: currentFrame });
  };

  return (b: KeyMapBuilder) => {
    b.on(null, "Delete", deleteSelected, "Delete", "Delete selected annotation");
    b.on([b.Ctrl], "Backspace", deleteSelected, "Delete", "Delete selected annotation");
    b.on(null, "H", toggleHidden, "Toggle Hidden", "Hide/Show selected annotation");
    b.on(null, "L", toggleLocked, "Toggle Locked", "Lock/Unlock selected annotation");
    b.on(null, "S", splitAnnotation, "Split", "Split selected annotation at selected frame");
  };
};

// Add mode and shortcut definitions for selected annotation/object here.
const SELECTION_MODE_BUILDERS: Record<string, (context: SelectionKeyMapContext) => (b: KeyMapBuilder) => void> = {
  [IDAH_VIDEO_BOUNDING_BOX]: buildOnSelectBoundingBoxModeShortcuts,
  [IDAH_VIDEO_POLYGON]: buildOnSelectPolygonModeShortcuts,
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