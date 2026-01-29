export type KeyMap = {
  [key: string]: {
    name: string;
    description: string;
    action: () => void;
  };
};

type KeyMapList = {
  [key: string]: {
    [key: string]: {
      name: string;
      description: string;
      action: () => void;
    };
  };
};

export const ShortcutManager = {
  defaultMode: "visual",
  currentMode: [] as string[],

  /** Dictionary of all base shortcuts (registered once on mount): */
  keyMap: {} as KeyMapList,

  /** Single extension layer for dynamic shortcuts (e.g., selection-specific): */
  keyMapExtension: {} as KeyMapList,

  enterMode(mode: string, replace: boolean = false) {
    if (replace) {
      if (this.currentMode.length == 0) {
        this.currentMode[0] = mode;
      } else {
        this.currentMode[this.currentMode.length - 1] = mode;
      }
    } else {
      this.currentMode.push(mode);
    }
  },

  leaveMode() {
    this.currentMode.pop();
    if (this.currentMode.length == 0) {
      this.currentMode[0] = this.defaultMode;
    }
  },

  getCurrentMode() {
    return this.currentMode[this.currentMode.length - 1];
  },

  registerKeyMap(mode: string, keyMap: KeyMap) {
    this.keyMap[mode] = keyMap;
  },

  /** Set extension keymap for a mode. */
  setKeyMapExtension(mode: string, keyMap: KeyMap) {
    this.keyMapExtension[mode] = keyMap;
  },

  /** Clear extension keymap for a specific mode. */
  clearKeyMapExtension(mode: string) {
    delete this.keyMapExtension[mode];
  },

  /** Clear all extension keymaps across all modes.*/
  clearAllKeyMapExtensions() {
    this.keyMapExtension = {};
  },

  /**
   * Get the effective keymap for a mode (base + extension merged).
   * Extension shortcuts take precedence over base shortcuts for duplicate keys.
   */
  getEffectiveKeyMap(mode: string): KeyMap {
    const baseKeyMap = this.keyMap[mode] || {};
    const extensionKeyMap = this.keyMapExtension[mode] || {};

    return { ...baseKeyMap, ...extensionKeyMap };
  },
};
