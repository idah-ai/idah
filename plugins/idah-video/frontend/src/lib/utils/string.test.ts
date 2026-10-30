import { describe, expect, it } from "vitest";
import { truncateMiddle } from "./string";

describe("truncateMiddle", () => {
  it("keeps labels that would not become shorter", () => {
    expect(truncateMiddle("Bounding-box / Bus")).toBe("Bounding-box / Bus");
    expect(truncateMiddle("12345678901234567890123")).toBe("12345678901234567890123");
  });

  it("shows ten characters from each end by default", () => {
    expect(truncateMiddle("This / Is / A / Very / Long / Category / Testing"))
      .toBe("This / Is ... / Testing");
  });

  it("accepts separate lengths without splitting Unicode characters", () => {
    expect(truncateMiddle("😀abcdefghi123456789🌟", 2, 3)).toBe("😀a...89🌟");
  });
});
