import { describe, expect, it } from "vitest";

import { dividerBefore } from "./toolbar-sections";

describe("dividerBefore", () => {
  it("draws a divider wherever the section changes", () => {
    expect(dividerBefore(["select", "draw", "draw", "aid", "check", "check"])).toEqual([
      false,
      true,
      false,
      true,
      true,
      false,
    ]);
  });

  it("never draws one before the first button", () => {
    expect(dividerBefore(["draw"])).toEqual([false]);
    expect(dividerBefore([])).toEqual([]);
  });

  it("closes the gap when a whole section is missing", () => {
    // No drawing tools enabled: select | aid stays a single divider.
    expect(dividerBefore(["select", "aid", "check"])).toEqual([false, true, true]);
  });

  it("treats buttons without a section as one unnamed section", () => {
    expect(dividerBefore([undefined, undefined, "check"])).toEqual([false, false, true]);
  });
});
