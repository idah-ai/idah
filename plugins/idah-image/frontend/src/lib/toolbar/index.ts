// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";
import circleIcon from "$lib/assets/icons/circle.svg?raw";
import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import ellipseIcon from "$lib/assets/icons/ellipse.svg?raw";
import lineIcon from "$lib/assets/icons/minimize-2.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";
import brushIcon from "$lib/assets/icons/brush.svg?raw";
import maskPolygonIcon from "$lib/assets/icons/mask-polygon.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";
import doubleCheckIcon from "$lib/assets/icons/check-check.svg?raw";
import trashIcon from "$lib/assets/icons/trash.svg?raw";
import eyeIcon from "$lib/assets/icons/eye.svg?raw";
import eraserIcon from "$lib/assets/icons/eraser.svg?raw";
import eyeOffIcon from "$lib/assets/icons/eye-off.svg?raw";
import {
  DEFAULT_MODE,
  IMAGE_BOUNDING_BOX,
  IMAGE_CIRCLE,
  IMAGE_ELLIPSE,
  IMAGE_LINE,
  IMAGE_POLYGON,
  IMAGE_MASK,
  NOTE_MODE,
  REVIEW_MODE,
} from "$lib/types";
import { hasConfig } from "$idah/v2/utils";
import { magneticSnap } from "$lib/state/magnetic-snap.svelte";
import { maskTool } from "$lib/state/mask-tool.svelte";
import { toolPanel } from "$lib/state/tool-panel.svelte";
import { history } from "$lib/state/history.svelte";
import MaskToolConfigurations from "$lib/components/App/MaskToolPanel/MaskToolConfigurations.svelte";
import { ui } from "$lib/state/ui.svelte";
import { DONE_AREA_MODES, registerCoverageModeWatcher } from "$lib/commands/coverage-mask/_shared";
import { hasDoneArea } from "$lib/mask/done-area";
import { data } from "$lib/state/data.svelte";

// ── History icon as inline SVG ─────────────────────────────────────────
const historyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`;

// ── Magnet icon as inline SVG ──────────────────────────────────────────
const magnetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15 16 19"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="M5 8 9 12"/></svg>`;

export function initToolbar(driver: IIdahDriverV2): void {
  const t = driver.toolbar;

  // Layout (registration order = toolbar order; a divider separates sections):
  //   annotate: selection, box, polygon, mask ▾, line, circle, ellipse (review: note)
  //   | assist: magnetic snap, Done Area ▾, history

  // ── Select ─────────────────────────────────────────────────────────
  t.add({
    name: "idah-image:tool.selection",
    icon: cursorIcon,
    label: "Selection",
    modes: ["*"],
    group: null,
    section: "annotate",
    // Same command as the D shortcut: back to the resting mode, leaving Done Area add/remove.
    onClick: () => driver.command.call("idah-image:tool.selection"),
    // Done Area add/remove runs inside the resting mode, so Selection is only "on" without it.
    whenToggled: () => (driver.mode === DEFAULT_MODE || driver.mode === REVIEW_MODE) && !ui.coverageMaskActive,
  });
  // ── Annotation tools — most-used shapes first ─────────────────────────────────
  if (hasConfig(driver, IMAGE_BOUNDING_BOX)) {
    t.add({
      icon: rectIcon,
      label: "Bounding Box",
      name: "idah-image:tool.bounding-box",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: null,
      section: "annotate",
      onClick: () =>
        driver.mode === IMAGE_BOUNDING_BOX ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_BOUNDING_BOX),
      whenToggled: () => driver.mode === IMAGE_BOUNDING_BOX,
    });
  }
  if (hasConfig(driver, IMAGE_POLYGON)) {
    t.add({
      icon: polyIcon,
      label: "Polygon",
      name: "idah-image:tool.polygon",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: null,
      section: "annotate",
      onClick: () => (driver.mode === IMAGE_POLYGON ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_POLYGON)),
      whenToggled: () => driver.mode === IMAGE_POLYGON,
    });
  }
  if (hasConfig(driver, IMAGE_MASK)) {
    // One dropdown titled "Mask": Mask Brush (Q), Mask Polygon (W).
    t.defineGroup("mask", { label: "Mask", icon: brushIcon, section: "annotate" });
    t.add({
      icon: brushIcon,
      label: "Mask Brush",
      name: "idah-image:tool.mask-brush",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "mask",
      section: "annotate",
      onClick: () => {
        if (driver.mode === IMAGE_MASK && maskTool.active === "brush") {
          driver.setMode(DEFAULT_MODE);
        } else {
          maskTool.active = "brush";
          toolPanel.show(MaskToolConfigurations);
          driver.toolbar.invalidate();
          driver.setMode(IMAGE_MASK);
        }
      },
      whenToggled: () => driver.mode === IMAGE_MASK && maskTool.active === "brush",
    });
    t.add({
      icon: maskPolygonIcon,
      label: "Mask Polygon",
      name: "idah-image:tool.mask-polygon",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "mask",
      section: "annotate",
      onClick: () => {
        if (driver.mode === IMAGE_MASK && maskTool.active === "polygon") {
          driver.setMode(DEFAULT_MODE);
        } else {
          maskTool.active = "polygon";
          toolPanel.show(MaskToolConfigurations);
          driver.toolbar.invalidate();
          driver.setMode(IMAGE_MASK);
        }
      },
      whenToggled: () => driver.mode === IMAGE_MASK && maskTool.active === "polygon",
    });
  }
  if (hasConfig(driver, IMAGE_LINE)) {
    t.add({
      icon: lineIcon,
      label: "Line",
      name: "idah-image:tool.line",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: null,
      section: "annotate",
      onClick: () => (driver.mode === IMAGE_LINE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_LINE)),
      whenToggled: () => driver.mode === IMAGE_LINE,
    });
  }
  if (hasConfig(driver, IMAGE_CIRCLE)) {
    t.add({
      icon: circleIcon,
      label: "Circle",
      name: "idah-image:tool.circle",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: null,
      section: "annotate",
      onClick: () => (driver.mode === IMAGE_CIRCLE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_CIRCLE)),
      whenToggled: () => driver.mode === IMAGE_CIRCLE,
    });
  }
  if (hasConfig(driver, IMAGE_ELLIPSE)) {
    t.add({
      icon: ellipseIcon,
      label: "Ellipse",
      name: "idah-image:tool.ellipse",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: null,
      section: "annotate",
      onClick: () => (driver.mode === IMAGE_ELLIPSE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_ELLIPSE)),
      whenToggled: () => driver.mode === IMAGE_ELLIPSE,
    });
  }
  t.add({
    icon: noteIcon,
    label: "Note",
    name: "idah-image:tool.note",
    modes: [REVIEW_MODE, NOTE_MODE],
    group: null,
    section: "annotate",
    onClick: () => driver.setMode(NOTE_MODE),
    whenToggled: () => driver.mode === NOTE_MODE,
  });


  // ── Magnetic snap toggle (available in all edit modes) ──────────────
  t.add({
    icon: magnetIcon,
    label: "Magnetic snap",
    name: "idah-image:snap.toggle-magnetic",
    modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE],
    group: null,
    section: "assist",
    onClick: () => {
      magneticSnap.toggle();
      driver.toolbar.invalidate();
    },
    whenToggled: () => magneticSnap.enabled,
  });

  // ── Done Area (Coverage Mask) ──────────────────────────────────────
  // One dropdown titled "Done Area": Hide/Show, Add Area, Remove Area, then Clear All.

  // Light green while the entry has a Done Area (ShapesContainer invalidates on change).
  t.defineGroup("done-area", {
    label: "Done Area",
    icon: doubleCheckIcon,
    whenAccented: () => hasDoneArea(data.annotations?.items),
    accentVariant: "success",
    section: "assist",
  });

  t.add({
    name: "coverage-mask-add",
    icon: doubleCheckIcon,
    label: "Add Area",
    modes: DONE_AREA_MODES,
    group: "done-area",
    section: "assist",
    toggledVariant: "success",
    onClick: () => {
      const active = ui.coverageMaskActive && !ui.coverageMaskIsRemove;
      driver.command.call("coverage-mask-set-mode", { mode: active ? "off" : "add" });
    },
    whenToggled: () => ui.coverageMaskActive && !ui.coverageMaskIsRemove,
  });

  t.add({
    name: "coverage-mask-remove",
    icon: eraserIcon,
    label: "Remove Area",
    modes: DONE_AREA_MODES,
    group: "done-area",
    section: "assist",
    toggledVariant: "destructive",
    onClick: () => {
      const active = ui.coverageMaskActive && ui.coverageMaskIsRemove;
      driver.command.call("coverage-mask-set-mode", { mode: active ? "off" : "remove" });
    },
    whenToggled: () => ui.coverageMaskActive && ui.coverageMaskIsRemove,
  });

  t.add({
    name: "coverage-mask-toggle-visibility",
    // Icon and label describe what a click does: hide while visible, show while hidden.
    icon: () => (ui.coverageMaskVisible ? eyeOffIcon : eyeIcon),
    label: () => (ui.coverageMaskVisible ? "Hide" : "Show"),
    modes: DONE_AREA_MODES,
    group: "done-area",
    section: "assist",
    // Same command as the H shortcut; hiding also leaves add/remove.
    onClick: () => driver.command.call("coverage-mask-toggle-visibility"),
  });

  t.add({
    name: "coverage-mask-clear",
    icon: trashIcon,
    label: "Clear All",
    modes: DONE_AREA_MODES,
    group: "done-area",
    section: "assist",
    variant: "destructive",
    separatorBefore: true,
    onClick: () => driver.command.call("coverage-mask-clear"),
  });

  // ── History toggle (last tool of the "assist" section) ──
  // The item is hidden when the driver has no `changes()` (an older platform).
  if (typeof driver.annotations.changes === "function") {
    t.add({
      icon: historyIcon,
      label: "History",
      name: "idah-image:history.toggle", // same as the Y command, so the tooltip shows its key
      modes: [
        DEFAULT_MODE,
        REVIEW_MODE,
        NOTE_MODE,
        IMAGE_BOUNDING_BOX,
        IMAGE_CIRCLE,
        IMAGE_ELLIPSE,
        IMAGE_LINE,
        IMAGE_POLYGON,
        IMAGE_MASK,
      ],
      group: null,
      section: "assist",
      visibleWhen: () => true,
      onClick: () => history.toggle(),
      whenToggled: () => history.open,
    });
  }

  // Watch for mode changes to other tools and deactivate coverage state
  registerCoverageModeWatcher(driver);
}
