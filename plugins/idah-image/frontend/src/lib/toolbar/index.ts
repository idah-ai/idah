// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";

import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";

export function initToolbar(driver: IIdahDriverV2): void {
  const t = driver.toolbar;

  t.add({
    icon: cursorIcon,
    label: "Select",
    modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
    group: "selection",
    onClick: () => driver.setMode("default"),
    whenToggled: () => driver.mode === "default",
  });
  t.add({
    icon: rectIcon,
    label: "Bounding Box",
    modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
    group: "selection",
    onClick: () =>
      driver.mode === "idah-image:bounding-box" ? driver.setMode("default") : driver.setMode("idah-image:bounding-box"),
    whenToggled: () => driver.mode === "idah-image:bounding-box",
  });
  t.add({
    icon: polyIcon,
    label: "Polygon",
    modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
    group: "selection",
    onClick: () =>
      driver.mode === "idah-image:polygon" ? driver.setMode("default") : driver.setMode("idah-image:polygon"),
    whenToggled: () => driver.mode === "idah-image:polygon",
  });
  t.add({
    icon: noteIcon,
    label: "Note",
    modes: ["default", "idah-image:bounding-box", "idah-image:polygon", "note"],
    group: "selection",
    onClick: () => driver.setMode("note"),
    whenToggled: () => driver.mode === "note",
  });

  t.orderGroups("default", ["selection"]);
  t.orderGroups("idah-image:bounding-box", ["selection"]);
  t.orderGroups("idah-image:polygon", ["selection"]);
  t.orderGroups("note", ["selection"]);
}
