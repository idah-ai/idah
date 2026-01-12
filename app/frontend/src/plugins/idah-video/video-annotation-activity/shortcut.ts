import { KeyMapBuilder } from "@/shortcut/KeyMapBuilder";
import { ShortcutManager } from "@/shortcut/ShortcutManager";
import { DEFAULT_MODE, IDAH_NOTE, IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP } from "../type";
import type Video from "./video.svelte";
import type { IActivityContext } from "@/plugin/interface/Activity";

// let see what we need
type KeyMapContext = {
  context: IActivityContext;
  player: () => Video | undefined;
  toggleCommandCB: () => void;
  flush: () => void;
  switch_mode: (mode: string) => void;
  zoom: { in: () => void; out: () => void };
};

const CommonInjecter = (context: KeyMapContext) => {
  const flushAction = () => {
    context.flush();
  };

  const redoAction = () => {
    context.context.commands.redo();
  };

  const undoAction = () => {
    context.context.commands.undo();
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

  return (b) => {
    b.on([b.Alt], "S", flushAction, "Flush", "flush action");
    b.on([b.Ctrl], "Space", toggleCommand, "Commands Dialog", "Toggle this commands dialog");
    b.on([b.Ctrl], "Z", undoAction, "Undo", "Undo last action");
    b.on([b.Ctrl, b.Shift], "Z", redoAction, "Redo", "Redo last undone action if any");

    // modes
    b.on(null, "D", enterMode(ShortcutManager.defaultMode, true), "Default View", "Reset View");
    b.on(null, "Escape", enterMode(ShortcutManager.defaultMode, true), "Default View", "Reset View");
    b.on(null, "B", enterMode(IDAH_VIDEO_BOUNDING_BOX), "Bounding box", "Enter Bouding box mode");
    b.on(null, "N", enterMode(IDAH_NOTE), "Note", "Enter Note mode");
  };
};

const createBoundingBoxModeKeyMap = (context: KeyMapContext) => {
  const backAction = () => {
    ShortcutManager.leaveMode();
    context.switch_mode(ShortcutManager.getCurrentMode());
  };

  return KeyMapBuilder((b) => {
    CommonInjecter(context)(b);

    b.on(null, "Backspace", backAction, "back", "back action");
  });
};

const createVisualModeKeyMap = (context: KeyMapContext) => {
  const tooglePlay = () => {
    context.player()?.togglePlay();
    console.log("Toggle play action executed");
  };

  const nextFrame = () => {
    context.player()?.nextFrame();
    console.log("Next Frame executed");
  };

  const nextMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || 10;
    context.player()?.nextFrame(frameStep);
    console.log(`Next ${frameStep} Frame executed`);
  };

  const previousFrame = () => {
    context.player()?.previousFrame();
    console.log("Previous Frame executed");
  };

  const previousMultipleFrames = () => {
    const frameStep = Number(localStorage.getItem(IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP)) || 10;
    context.player()?.previousFrame(frameStep);
    console.log(`Previous ${frameStep} Frame executed`);
  };

  const startFrame = () => {
    context.player()?.seekToFrame(0);
    console.log("startFrame executed");
  };

  const endFrame = () => {
    context.player()?.seekToFrame(context.player()?.getFrames() || 0);
    console.log("endFrame executed");
  };

  const keyMap = KeyMapBuilder((b) => {
    CommonInjecter(context)(b);
    b.on(null, "Space", tooglePlay, "Toogle Play", "Play/Pause the video player");
    b.on(null, "ArrowRight", nextFrame, "Next", "go to the next frame");
    b.on(null, "ArrowLeft", previousFrame, "Previous", "go to the previous frame");
    b.on(null, "V", nextMultipleFrames, "Next 10 Frames", "Go to the next 10 frames");
    b.on(null, "C", previousMultipleFrames, "Previous 10 Frames", "Go to the Previous 10 frames");
    b.on([b.Ctrl, b.Alt], "ArrowRight", endFrame, "End", "go to the starting frame");
    b.on([b.Ctrl, b.Alt], "ArrowLeft", startFrame, "Start", "go to the ending frame");

    // test, need uniform way to map accross keyboards (-/+)
    b.on(null, "Equal", context.zoom.in, "Zoom in", "Zoom In");
    b.on(null, "Minus", context.zoom.out, "Zoom Out", "Zoom Out");
  });

  return keyMap;
};

// need note mode ?
// open/close note sidebar on mode enter/leave ?
const createNoteModeKeyMap = (context: KeyMapContext) => {
  return KeyMapBuilder((b) => {
    CommonInjecter(context)(b);

    // shift+enter to submit current editing note ?
  });
};

export function registerVisualModeShortcuts(context: KeyMapContext) {
  const visualModeKeyMap = createVisualModeKeyMap(context);
  const boundingBoxModeKeyMap = createBoundingBoxModeKeyMap(context);
  const noteModeKeyMap = createNoteModeKeyMap(context);

  ShortcutManager.registerKeyMap(DEFAULT_MODE, visualModeKeyMap);
  ShortcutManager.registerKeyMap(IDAH_VIDEO_BOUNDING_BOX, boundingBoxModeKeyMap);
  ShortcutManager.registerKeyMap(IDAH_NOTE, noteModeKeyMap);

  // Set visual as the default mode if needed
  ShortcutManager.defaultMode = DEFAULT_MODE;

  // Enter visual mode
  ShortcutManager.enterMode(DEFAULT_MODE);

  console.log("Visual mode shortcuts registered");

  return visualModeKeyMap;
}
