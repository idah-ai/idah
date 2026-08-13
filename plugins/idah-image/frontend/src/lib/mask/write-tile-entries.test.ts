import { describe, it, expect, vi } from "vitest";
import { writeTileEntries } from "./write-tile-entries";

describe("writeTileEntries", () => {
  it("calls setShape for a single entry", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { setShape, setShapes };

    await writeTileEntries(annotations, "ann-1", [{ key: "tile-0x0", value: { rle: "ABC" } }]);

    expect(setShape).toHaveBeenCalledWith("ann-1", "tile-0x0", { rle: "ABC" });
    expect(setShapes).not.toHaveBeenCalled();
  });

  it("calls setShapes for multiple entries", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { setShape, setShapes };

    await writeTileEntries(annotations, "ann-1", [
      { key: "tile-0x0", value: { rle: "ABC" } },
      { key: "tile-0x1", value: { rle: "DEF" } },
    ]);

    expect(setShapes).toHaveBeenCalledWith("ann-1", [
      { key: "tile-0x0", value: { rle: "ABC" } },
      { key: "tile-0x1", value: { rle: "DEF" } },
    ]);
    expect(setShape).not.toHaveBeenCalled();
  });

  it("does nothing for empty entries", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { setShape, setShapes };

    await writeTileEntries(annotations, "ann-1", []);

    expect(setShape).not.toHaveBeenCalled();
    expect(setShapes).not.toHaveBeenCalled();
  });

  it("passes null values correctly", async () => {
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { setShape, setShapes };

    await writeTileEntries(annotations, "ann-1", [{ key: "tile-0x0", value: null }]);

    expect(setShape).toHaveBeenCalledWith("ann-1", "tile-0x0", null);
  });
});