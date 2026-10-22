import { describe, it, expect } from "vitest";
import { selectionSummary } from "./upload-summary";

describe("selectionSummary", () => {
  it("combines the selection count with the ignored count", () => {
    expect(selectionSummary(3, "dataset", "to create", 2)).toBe("3 datasets to create · 2 files ignored");
    expect(selectionSummary(1, "item", "to upload", 0)).toBe("1 item to upload");
    expect(selectionSummary(0, "item", "to upload", 1)).toBe("1 file ignored");
    expect(selectionSummary(0, "item", "to upload", 0)).toBe("");
  });
});
