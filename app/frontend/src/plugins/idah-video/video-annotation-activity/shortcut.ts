import CommandManager from "@/command/CommandManager";
import { KeyMapBuilder } from "@/shortcut/KeyMapBuilder";
import { ShortcutManager } from "@/shortcut/ShortcutManager";
import type Video from "./video.svelte";

const CommonInjecter = (context: KeyMapContext) => {
  const flushAction = () => {
    context.flush();
  };

  const redoAction = () => {
    CommandManager.redo();
  };

  const undoAction = () => {
    CommandManager.undo();
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
    b.on([b.Ctrl], "Z", undoAction, "Undo", "Undo last action");
    b.on([b.Ctrl], "Space", toggleCommand, "Commands Dialog", "Toggle this commands dialog");

    b.on([b.Ctrl, b.Shift], "Z", redoAction, "Redo", "Redo last undone action if any");
    // b.on(null, "D", enterMode(ShortcutManager.defaultMode, true), "Default View", "Reset View");
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

// let see what we need
type KeyMapContext = {
  player: () => Video | undefined;
  toggleCommandCB: () => void;
  flush: () => void;
  switch_mode: (mode: string) => void;
  zoom: { in: () => void; out: () => void };
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

  const previousFrame = () => {
    context.player()?.previousFrame();
    console.log("Previous Frame executed");
  };
  const startFrame = () => {
    context.player()?.seekToFrame(0);
    console.log("startFrame executed");
  };
  const endFrame = () => {
    context.player()?.seekToFrame((context.player()?.getFrames() || 0));
    console.log("endFrame executed");
  };

  //   const enterMode = (mode: string, replace: boolean = false) => {
  //     return () => {
  //       ShortcutManager.enterMode(mode, replace);
  //       context.switch_mode(mode);
  //     };
  //   };

  const keyMap = KeyMapBuilder((b) => {
    CommonInjecter(context)(b);
    b.on(null, "Space", tooglePlay, "Toogle Play", "Play/Pause the video player");
    b.on(null, "ArrowRight", nextFrame, "Next", "go to the next frame");
    b.on(null, "ArrowLeft", previousFrame, "Previous", "go to the previous frame");
    b.on([b.Ctrl, b.Alt], "ArrowRight", endFrame, "End", "go to the starting frame");
    b.on([b.Ctrl, b.Alt], "ArrowLeft", startFrame, "Start", "go to the ending frame");
    // b.on(null, "B", enterMode("video:bounding_box"), "Bounding box", "Enter Bouding box mode");
    // b.on(null, "+", () => context.zoom.in(), "Zoom in", "Zoom In");
    // b.on(null, "-", () => context.zoom.out(), "Zoom Out", "Zoom Out");
  });

  return keyMap;
};

export function registerVisualModeShortcuts(context: KeyMapContext) {
  const visualModeKeyMap = createVisualModeKeyMap(context);
  const boundingBoxModeKeyMap = createBoundingBoxModeKeyMap(context);

  ShortcutManager.registerKeyMap("visual", visualModeKeyMap);
  ShortcutManager.registerKeyMap("video:bounding_box", boundingBoxModeKeyMap);

  // Set visual as the default mode if needed
  ShortcutManager.defaultMode = "visual";

  // Enter visual mode
  ShortcutManager.enterMode("visual");

  console.log("Visual mode shortcuts registered");

  return visualModeKeyMap;
}
