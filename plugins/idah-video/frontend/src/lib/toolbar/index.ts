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
  t.add({
    icon: rectIcon,
    label: "Bounding Box",
    name: "mode.idah-video:bounding_box",
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    group: "selection",
    visibleWhen: () => driver.mode !== "review" && driver.mode !== "note",
    onClick: (() =>
      (driver.mode === "idah-video:bounding-box") ? driver.setMode("editor") :
        driver.setMode("idah-video:bounding-box")),
    whenToggled: () => driver.mode === "idah-video:bounding-box",
  });
  t.add({
    icon: polyIcon,
    label: "Polygon",
    name: "mode.idah-video:polygon",
    modes: ["editor", "idah-video:bounding-box", "idah-video:polygon"],
    group: "selection",
    visibleWhen: () => driver.mode !== "review" && driver.mode !== "note",
    onClick: (() =>
      (driver.mode === "idah-video:polygon") ? driver.setMode("editor") :
        driver.setMode("idah-video:polygon")),
    whenToggled: () => driver.mode === "idah-video:polygon",
  });
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
  t.orderGroups("idah-video:bounding-box", ["selection"]);
  t.orderGroups("idah-video:polygon", ["selection"]);
  t.orderGroups("review", ["selection"]);
  t.orderGroups("note", ["selection"]);
}
