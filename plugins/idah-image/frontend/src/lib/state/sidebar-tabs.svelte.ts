// ---------------------------------------------------------------------------
// sidebar-tabs.svelte.ts — Right-sidebar tab state (Annotations / Tagging)
//
// Shared between the PropertiesCategorySelector component (which renders the
// tabs) and the keyboard-shortcut commands (which jump between tabs). Stored
// as a Svelte 5 rune object so both can read/write it reactively.

export type RightTab = "annotations" | "tagging";

let _rightTab: RightTab = $state("annotations");

export const sidebarTabs: {
  rightTab: RightTab;
} = {
  get rightTab() {
    return _rightTab;
  },
  set rightTab(v: RightTab) {
    _rightTab = v;
  },
};
