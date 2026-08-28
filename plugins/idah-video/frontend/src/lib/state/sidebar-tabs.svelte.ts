// ---------------------------------------------------------------------------
// sidebar-tabs.svelte.ts — Right-sidebar tab state (Annotations / Meta)
//
// Shared between the PropertiesCategorySelector component (which renders the
// tabs) and the keyboard-shortcut commands (which jump between tabs). Stored
// as a Svelte 5 rune object so both can read/write it reactively.
// ---------------------------------------------------------------------------

export type RightTab = "annotations" | "meta";
export type MetaTab = "entry" | "frame";

let _rightTab: RightTab = $state("annotations");
let _metaTab: MetaTab = $state("entry");

export const sidebarTabs: {
  rightTab: RightTab;
  metaTab: MetaTab;
} = {
  get rightTab() {
    return _rightTab;
  },
  set rightTab(v: RightTab) {
    _rightTab = v;
  },
  get metaTab() {
    return _metaTab;
  },
  set metaTab(v: MetaTab) {
    _metaTab = v;
  },
};