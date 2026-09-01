// ---------------------------------------------------------------------------
// sidebar-tabs.svelte.ts — Right-sidebar tab state (Annotations / Tagging)
//
// Shared between the PropertiesCategorySelector component (which renders the
// tabs) and the keyboard-shortcut commands (which jump between tabs). Stored
// as a Svelte 5 rune object so both can read/write it reactively.

export type RightTab = "annotations" | "tagging";
export type TaggingTab = "entry" | "frame";

let _rightTab: RightTab = $state("annotations");
let _taggingTab: TaggingTab = $state("entry");

export const sidebarTabs: {
  rightTab: RightTab;
  taggingTab: TaggingTab;
} = {
  get rightTab() {
    return _rightTab;
  },
  set rightTab(v: RightTab) {
    _rightTab = v;
  },
  get taggingTab() {
    return _taggingTab;
  },
  set taggingTab(v: TaggingTab) {
    _taggingTab = v;
  },
};