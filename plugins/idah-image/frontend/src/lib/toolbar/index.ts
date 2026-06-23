// toolbar/index.ts — Register toolbar items with the V2 driver
import type { IIdahDriverV2 } from "$idah/v2/types";
import circleIcon from "$lib/assets/icons/circle.svg?raw";
import cursorIcon from "$lib/assets/icons/cursor.svg?raw";
import lineIcon from "$lib/assets/icons/minimize-2.svg?raw";
import noteIcon from "$lib/assets/icons/message-circle.svg?raw";
import polyIcon from "$lib/assets/icons/polygon.svg?raw";
import rectIcon from "$lib/assets/icons/vector-square.svg?raw";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_LINE, IMAGE_POLYGON, NOTE_MODE, REVIEW_MODE } from "$lib/types";

export function initToolbar(driver: IIdahDriverV2): void {
  function hasConfig(type: string): boolean {
    const cfg = driver.config[type];
    return !!(cfg && cfg.values && cfg.values.length > 0);
  }

  const t = driver.toolbar;

  t.add({
    name: "mode.select",
    icon: cursorIcon,
    label: "Select",
    modes: ['*'],
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
  if (hasConfig(IMAGE_BOUNDING_BOX)) {
    t.add({
      icon: rectIcon,
      label: "Bounding Box",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, IMAGE_LINE, IMAGE_CIRCLE],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_BOUNDING_BOX ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_BOUNDING_BOX),
        whenToggled: () => driver.mode === IMAGE_BOUNDING_BOX,
    });
    t.orderGroups(IMAGE_BOUNDING_BOX, ["selection"]);
  }
  if (hasConfig(IMAGE_POLYGON)) {
    t.add({
      icon: polyIcon,
      label: "Polygon",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, IMAGE_LINE, IMAGE_CIRCLE],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_POLYGON ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_POLYGON),
        whenToggled: () => driver.mode === IMAGE_POLYGON,
    });
    t.orderGroups(IMAGE_POLYGON, ["selection"]);
  }
  if (hasConfig(IMAGE_CIRCLE)) {
    t.add({
      icon: circleIcon,
      label: "Circle",
      name: "mode.circle",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_POLYGON, IMAGE_LINE],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_CIRCLE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_CIRCLE),
        whenToggled: () => driver.mode === IMAGE_CIRCLE,
    });
    t.orderGroups(IMAGE_CIRCLE, ["selection"]);
  }
  if (hasConfig(IMAGE_LINE)) {
    t.add({
      icon: lineIcon,
      label: "Line",
      name: "mode.line",
      modes: [DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_CIRCLE, IMAGE_POLYGON, IMAGE_LINE],
      group: "selection",
      onClick: () =>
        driver.mode === IMAGE_LINE ? driver.setMode(DEFAULT_MODE) : driver.setMode(IMAGE_LINE),
        whenToggled: () => driver.mode === IMAGE_LINE,
    });
    t.orderGroups(IMAGE_LINE, ["selection"]);
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
}
