// ---------------------------------------------------------------------------
// mask-tool.svelte.ts — Sub-tool selection for mask mode
//
// Both brush and polygon tools use IMAGE_MASK mode. This state tracks
// which sub-tool is currently active within that mode.
// ---------------------------------------------------------------------------

export type MaskSubTool = "brush" | "polygon";

let _activeSubTool: MaskSubTool = $state("brush");
let _brushRadius = $state(20); // image-pixel units
let _preventOverlap = $state(false);

export const maskTool = {
  get active(): MaskSubTool {
    return _activeSubTool;
  },
  set active(tool: MaskSubTool) {
    _activeSubTool = tool;
  },

  get brushRadius(): number {
    return _brushRadius;
  },
  set brushRadius(radius: number) {
    _brushRadius = Math.max(0, Math.min(radius, 300));
  },

  get preventOverlap(): boolean {
    return _preventOverlap;
  },
  set preventOverlap(val: boolean) {
    _preventOverlap = val;
  },

  togglePreventOverlap(): void {
    _preventOverlap = !_preventOverlap;
  },
};
