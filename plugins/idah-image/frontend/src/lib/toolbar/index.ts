// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";
import circleIcon from "$lib/assets/icons/circle.svg?raw";
import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import ellipseIcon from "$lib/assets/icons/ellipse.svg?raw";
import lineIcon from "$lib/assets/icons/minimize-2.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";
import brushIcon from "$lib/assets/icons/brush.svg?raw";
import squareSlashIcon from "$lib/assets/icons/square-slash.svg?raw";
import maskPolygonIcon from "$lib/assets/icons/mask-polygon.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_LINE, IMAGE_POLYGON, IMAGE_MASK, NOTE_MODE, REVIEW_MODE } from "$lib/types";
import { hasConfig } from "$idah/v2/utils";
import { magneticSnap } from "$lib/state/magnetic-snap.svelte";
import { maskTool } from "$lib/state/mask-tool.svelte";

// ── Magnet icon as inline SVG ──────────────────────────────────────────
const magnetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15 16 19"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="M5 8 9 12"/></svg>`;

export function initToolbar(driver: IIdahDriverV2): void {
  const t = driver.toolbar;

  t.add({
    name: "mode.selection",
    icon: cursorIcon,
    label: "Selection",
    modes: ["*"],
    group: "selection",
    onClick: () => {
      // Return to the parent resting mode of the current workspace
      if (driver.mode === REVIEW_MODE || driver.mode === NOTE_MODE) {
        driver.setMode(REVIEW_MODE);
      } else {
        driver.setMode(DEFAULT_MODE);
      }
    },
    whenToggled: () => driver.mode === DEFAULT_MODE || driver.mode === REVIEW_MODE,
  });
  if (hasConfig(driver, IMAGE_BOUNDING_BOX)) {
    t.add({
      icon: rectIcon,
      label: "Bounding Box",
      name: "mode.bounding_box",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_BOUNDING_BOX ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_BOUNDING_BOX),
        whenToggled: () => driver.mode === IMAGE_BOUNDING_BOX,
    });
    t.orderGroups(IMAGE_BOUNDING_BOX, ["selection"]);
  }
  if (hasConfig(driver, IMAGE_POLYGON)) {
    t.add({
      icon: polyIcon,
      label: "Polygon",
      name: "mode.polygon",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_POLYGON ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_POLYGON),
        whenToggled: () => driver.mode === IMAGE_POLYGON,
    });
    t.orderGroups(IMAGE_POLYGON, ["selection"]);
  }
  if (hasConfig(driver, IMAGE_CIRCLE)) {
    t.add({
      icon: circleIcon,
      label: "Circle",
      name: "mode.circle",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_CIRCLE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_CIRCLE),
        whenToggled: () => driver.mode === IMAGE_CIRCLE,
    });
    t.orderGroups(IMAGE_CIRCLE, ["selection"]);
  }
  if (hasConfig(driver, IMAGE_ELLIPSE)) {
    t.add({
      icon: ellipseIcon,
      label: "Ellipse",
      name: "mode.ellipse",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_ELLIPSE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_ELLIPSE),
        whenToggled: () => driver.mode === IMAGE_ELLIPSE,
    });
    t.orderGroups(IMAGE_ELLIPSE, ["selection"]);
  }
  if (hasConfig(driver, IMAGE_LINE)) {
    t.add({
      icon: lineIcon,
      label: "Line",
      name: "mode.line",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_LINE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_LINE),
        whenToggled: () => driver.mode === IMAGE_LINE,
    });
    t.orderGroups(IMAGE_LINE, ["selection"]);
  }
  if (hasConfig(driver, IMAGE_MASK)) {
    t.add({
      icon: brushIcon,
      label: "Mask Brush",
      name: "mode.mask_brush",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () => {
        if (driver.mode === IMAGE_MASK && maskTool.active === "brush") {
          driver.setMode(DEFAULT_MODE);
        } else {
          maskTool.active = "brush";
          driver.toolbar.invalidate();
          driver.setMode(IMAGE_MASK);
        }
      },
      whenToggled: () => driver.mode === IMAGE_MASK && maskTool.active === "brush",
    });
    t.add({
      icon: maskPolygonIcon,
      label: "Mask Polygon",
      name: "mode.mask_polygon",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE, IMAGE_MASK],
      group: "selection",
      onClick: () => {
        if (driver.mode === IMAGE_MASK && maskTool.active === "polygon") {
          driver.setMode(DEFAULT_MODE);
        } else {
          maskTool.active = "polygon";
          driver.toolbar.invalidate();
          driver.setMode(IMAGE_MASK);
        }
      },
      whenToggled: () => driver.mode === IMAGE_MASK && maskTool.active === "polygon",
    });
    t.orderGroups(IMAGE_MASK, ["selection"]);
  }
  t.add({
    icon: noteIcon,
    label: "Note",
    name: "mode.note",
    modes: [REVIEW_MODE, NOTE_MODE],
    group: "selection",
    onClick: () => driver.setMode(NOTE_MODE),
    whenToggled: () => driver.mode === NOTE_MODE,
  });

  t.orderGroups(DEFAULT_MODE, ["selection"]);
  t.orderGroups(NOTE_MODE, ["selection"]);

  // ── Magnetic snap toggle (available in all edit modes) ──────────────
  t.add({
    icon: magnetIcon,
    label: "Magnetic snap",
    name: "snap.magnetic_toggle",
    modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_ELLIPSE, IMAGE_POLYGON, IMAGE_LINE],
    group: "selection",
    onClick: () => {
      magneticSnap.toggle();
      driver.toolbar.invalidate();
    },
    whenToggled: () => magneticSnap.enabled,
  });

  // ── Prevent mask overlap toggle (available in mask mode) ────────────
  t.add({
    icon: squareSlashIcon,
  label: "Prevent overlap",
    name: "mask.prevent_overlap",
    modes: [IMAGE_MASK],
    group: "selection",
    onClick: () => {
      maskTool.togglePreventOverlap();
      driver.toolbar.invalidate();
    },
    whenToggled: () => maskTool.preventOverlap,
  });
}
