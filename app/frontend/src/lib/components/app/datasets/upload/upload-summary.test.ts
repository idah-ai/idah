import { describe, it, expect } from "vitest";
import { selectionSummary } from "./upload-summary";

describe("selectionSummary", () => {
  it("describes the selection, and nothing when empty", () => {
    expect(selectionSummary(3, "dataset", "to create")).toBe("3 datasets to create");
    expect(selectionSummary(1, "item", "to upload")).toBe("1 item to upload");
    expect(selectionSummary(0, "item", "to upload")).toBe("");
  });
});
