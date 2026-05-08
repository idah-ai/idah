import { BuildKeymap } from "$idah/shortcut/key-map-builder";
import { ShortcutManager } from "$idah/shortcut/shortcut-manager.svelte";

// Example of creating a key map for a "visual" mode
const createVisualModeKeyMap = () => {
  // Define some example actions
  const copyAction = () => {
    console.log('Copy action executed');
    // Actual implementation would go here
  };

  const pasteAction = () => {
    console.log('Paste action executed');
    // Actual implementation would go here
  };

  const saveAction = () => {
    console.log('Save action executed');
    // Actual implementation would go here
  };

  const undoAction = () => {
    console.log('Undo action executed');
    // Actual implementation would go here
  };

  // Create a key map using the KeyMapBuilder DSL
  const keyMap = BuildKeymap((b) => {
    // Copy: Ctrl+C
    b.on([b.Ctrl], "C", copyAction, "copy", "Copy selected content");

    // Paste: Ctrl+V
    b.on([b.Ctrl], "V", pasteAction, "paste", "Paste content from clipboard");

    // Save: Ctrl+S
    b.on([b.Ctrl], "S", saveAction, "save", "Save current document");

    // Undo: Ctrl+Z
    b.on([b.Ctrl], "Z", undoAction, "undo", "Undo last action");

    // Example with multiple modifiers: Ctrl+Shift+S (Save As)
    b.on([b.Ctrl, b.Shift], "S", () => {
      console.log('Save As action executed');
    }, "save_as", "Save document with a new name");
  });

  return keyMap;
};

// Example of registering the key map with the ShortcutManager
export function registerVisualModeShortcuts() {
  const visualModeKeyMap = createVisualModeKeyMap();
  ShortcutManager.registerKeyMap('visual', visualModeKeyMap);

  // Set visual as the default mode if needed
  ShortcutManager.defaultMode = 'visual';

  // Enter visual mode
  ShortcutManager.enterMode('visual');

  console.log('Visual mode shortcuts registered');

  return visualModeKeyMap;
}

// Example usage:
// import { registerVisualModeShortcuts } from './KeyMapBuilderExample';
// const keyMap = registerVisualModeShortcuts();
