import { KeyMapBuilder } from './KeyMapBuilder';
import { ShortcutManager } from './ShortcutManager';

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
  const keyMap = KeyMapBuilder((b) => {
    // Copy: Ctrl+C
    b.on([b.Ctrl], "C", copyAction, "Copy", "Copy selected content");

    // Paste: Ctrl+V
    b.on([b.Ctrl], "V", pasteAction, "Paste", "Paste content from clipboard");

    // Save: Ctrl+S
    b.on([b.Ctrl], "S", saveAction, "Save", "Save current document");

    // Undo: Ctrl+Z
    b.on([b.Ctrl], "Z", undoAction, "Undo", "Undo last action");

    // Example with multiple modifiers: Ctrl+Shift+S (Save As)
    b.on([b.Ctrl, b.Shift], "S", () => {
      console.log('Save As action executed');
    }, "Save As", "Save document with a new name");
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
