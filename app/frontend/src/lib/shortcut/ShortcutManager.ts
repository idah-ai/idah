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

  // Dictionary of all the shortcuts:
  keyMap: {} as KeyMapList,

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
};
