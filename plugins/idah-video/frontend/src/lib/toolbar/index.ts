// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";

import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";

export function initToolbar(driver: IIdahDriverV2): void {
  const t = driver.toolbar;

  t.add({
    icon: cursorIcon,
    label: "Selection",
    name: "mode.default",
    modes: ["default", "idah-video:bounding-box", "idah-video:polygon", "note"],
    group: "selection",
    onClick: () => driver.setMode("default"),
    whenToggled: () => driver.mode === "default",
  });
  t.add({
    icon: rectIcon,
    label: "Bounding Box",
    name: "mode.idah-video:bounding_box",
    modes: ["default", "idah-video:bounding-box", "idah-video:polygon", "note"],
    group: "selection",
    onClick: (() =>
      (driver.mode === "idah-video:bounding-box") ? driver.setMode("default") :
        driver.setMode("idah-video:bounding-box")),
    whenToggled: () => driver.mode === "idah-video:bounding-box",
  });
  t.add({
    icon: polyIcon,
    label: "Polygon",
    name: "mode.idah-video:polygon",
    modes: ["default", "idah-video:bounding-box", "idah-video:polygon", "note"],
    group: "selection",
    onClick: (() =>
      (driver.mode === "idah-video:polygon") ? driver.setMode("default") :
        driver.setMode("idah-video:polygon")),
    whenToggled: () => driver.mode === "idah-video:polygon",
  });
  t.add({
    icon: noteIcon,
    label: "Note",
    name: "mode.note",
    modes: ["default", "idah-video:bounding-box", "idah-video:polygon", "note"],
    group: "selection",
    onClick: () => driver.setMode("note"),
    whenToggled: () => driver.mode === "note",
  });

  t.orderGroups("default", ["selection"]);
  t.orderGroups("idah-video:bounding-box", ["selection"]);
  t.orderGroups("idah-video:polygon", ["selection"]);
  t.orderGroups("note", ["selection"]);
}
