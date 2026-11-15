import { describe, expect, it } from "vitest";

import { orphanFilterChanges } from "./orphan-filter";

describe("orphanFilterChanges", () => {
  it("clears other user filters when enabled", () => {
    expect(orphanFilterChanges({ status: "pending", priority: "high" }, true)).toEqual({
      status: undefined,
      priority: undefined,
      orphan_categories: true,
    });
  });

  it("clears the orphan filter when disabled", () => {
    expect(orphanFilterChanges({ orphan_categories: "true" }, false)).toEqual({ orphan_categories: undefined });
  });
});
