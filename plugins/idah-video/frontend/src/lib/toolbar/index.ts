// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";
import { isEditable } from "$lib/state/editor.svelte";

import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";
import { BOUNDING_BOX_MODE, POLYGON_MODE } from "$lib/state/viewport.svelte";
import { hasConfig } from "$idah/v2/utils";
import { magneticSnap } from "$lib/state/magnetic-snap.svelte";

const magnetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15 16 19"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="M5 8 9 12"/></svg>`;

export function initToolbar(driver: IIdahDriverV2): void {
  const t = driver.toolbar;

  t.add({
    icon: cursorIcon,
    label: "Selection",
    name: "mode.selection",
    modes: ["editor", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
    group: "selection",
    visibleWhen: () => true,
    onClick: () => {
      // Return to the parent resting mode of the current workspace
      if (driver.mode === "review" || driver.mode === "note") {
        driver.setMode("review");
      } else {
        driver.setMode("editor");
      }
    },
    whenToggled: () => driver.mode === "editor" || driver.mode === "review",
  });

  if (hasConfig(driver, BOUNDING_BOX_MODE)) {
    t.add({
      icon: rectIcon,
      label: "Bounding Box",
      name: "mode.idah-video:bounding_box",
      modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
      group: "selection",
      visibleWhen: () => driver.mode !== "review" && driver.mode !== "note",
      onClick: () => {
        if (!isEditable()) return;
        if (driver.mode === "idah-video:bounding-box") driver.setMode("editor");
        else driver.setMode("idah-video:bounding-box");
      },
      whenToggled: () => driver.mode === "idah-video:bounding-box",
    });
    t.orderGroups("idah-video:bounding-box", ["selection"]);
  }
  if (hasConfig(driver, POLYGON_MODE)) {
    t.add({
      icon: polyIcon,
      label: "Polygon",
      name: "mode.idah-video:polygon",
      modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
      group: "selection",
      visibleWhen: () => driver.mode !== "review" && driver.mode !== "note",
      onClick: () => {
        if (!isEditable()) return;
        if (driver.mode === "idah-video:polygon") driver.setMode("editor");
        else driver.setMode("idah-video:polygon");
      },
      whenToggled: () => driver.mode === "idah-video:polygon",
    });
    t.orderGroups("idah-video:polygon", ["selection"]);
  }
  t.add({
    icon: noteIcon,
    label: "Note",
    name: "mode.note",
    modes: ["review", "note"],
    group: "selection",
    visibleWhen: () => driver.mode === "review" || driver.mode === "note",
    onClick: () => driver.setMode("note"),
    whenToggled: () => driver.mode === "note",
  });

  t.orderGroups("editor", ["selection"]);
  t.orderGroups("review", ["selection"]);
  t.orderGroups("note", ["selection"]);

  // ── Magnetic snap toggle ──────────────────────────────────────────
  t.add({
    icon: magnetIcon,
    label: "Magnetic snap",
    name: "snap.magnetic_toggle",
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    group: "selection",
    visibleWhen: () => driver.mode !== "review" && driver.mode !== "note",
    onClick: () => {
      magneticSnap.toggle();
      driver.toolbar.invalidate();
    },
    whenToggled: () => magneticSnap.enabled,
  });
}
