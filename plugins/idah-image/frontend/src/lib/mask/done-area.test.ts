import { describe, expect, it } from "vitest";

import { COVERAGE_DONE_AREA } from "$lib/types";
import { hasDoneArea } from "./done-area";

const record = (shape_args: Record<string, unknown> | undefined, shape_type = COVERAGE_DONE_AREA) => ({
  id: "a",
  shape_type,
  shape_args,
});

describe("hasDoneArea", () => {
  it("is false without annotations", () => {
    expect(hasDoneArea(undefined)).toBe(false);
    expect(hasDoneArea([])).toBe(false);
  });

  it("is false when no Done Area record exists", () => {
    expect(hasDoneArea([record({ "tile-0x0": { rle: [1] } }, "idah-image:bounding-box")])).toBe(false);
  });

  it("is false for a Done Area record whose tiles were all erased", () => {
    expect(hasDoneArea([record({ "tile-0x0": null, "tile-1x0": null })])).toBe(false);
    expect(hasDoneArea([record({})])).toBe(false);
    expect(hasDoneArea([record(undefined)])).toBe(false);
  });

  it("ignores non-tile keys", () => {
    expect(hasDoneArea([record({ width: 100 })])).toBe(false);
  });

  it("is true when at least one tile has content", () => {
    expect(hasDoneArea([record({ "tile-0x0": null, "tile-1x0": { rle: [3, 4] } })])).toBe(true);
  });
});
