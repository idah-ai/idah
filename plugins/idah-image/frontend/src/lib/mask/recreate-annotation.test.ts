// ---------------------------------------------------------------------------
// recreate-annotation.test.ts — Tests for recreateAnnotationWithTiles
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { recreateAnnotationWithTiles } from "./recreate-annotation";
import type { AnnotationItem } from "$lib/state/data.svelte";

describe("recreateAnnotationWithTiles", () => {
  it("calls create() with tile keys stripped from shape", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: {
        type: "idah-image:mask",
        "tile-0x0": { rle: "ABC" },
        "tile-0x1": { rle: "DEF" },
        x: 10,
        y: 20,
      } as any,
      value: { category: "cat" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    // create() must be called with the id preserved and tile keys stripped
    expect(create).toHaveBeenCalledWith({
      id: "ann-1",
      shape: { type: "idah-image:mask", x: 10, y: 20 },
      value: { category: "cat" },
    });
  });

  it("preserves all non-tile fields in the shape passed to create()", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: {
        type: "idah-image:bounding-box",
        x: 10,
        y: 20,
        width: 100,
        height: 200,
      } as any,
      value: { category: "car" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    // No tile keys to strip — shape should pass through unchanged
    expect(create).toHaveBeenCalledWith({
      id: "ann-1",
      shape: { type: "idah-image:bounding-box", x: 10, y: 20, width: 100, height: 200 },
      value: { category: "car" },
    });
  });

  it("restores a single tile via setShape", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: { type: "idah-image:mask", "tile-0x0": { rle: "ABC" } } as any,
      value: { category: "cat" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    // Single tile → setShape (singular)
    expect(setShape).toHaveBeenCalledWith("ann-1", "tile-0x0", { rle: "ABC" });
    expect(setShapes).not.toHaveBeenCalled();
  });

  it("restores multiple tiles via setShapes", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: {
        type: "idah-image:mask",
        "tile-0x0": { rle: "ABC" },
        "tile-0x1": { rle: "DEF" },
      } as any,
      value: { category: "cat" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    // Multiple tiles → setShapes (batched)
    expect(setShapes).toHaveBeenCalledWith("ann-1", [
      { key: "tile-0x0", value: { rle: "ABC" } },
      { key: "tile-0x1", value: { rle: "DEF" } },
    ]);
    expect(setShape).not.toHaveBeenCalled();
  });

  it("calls create() before tile-restore calls (ordering)", async () => {
    const callOrder: string[] = [];
    const create = vi.fn().mockImplementation(async () => {
      callOrder.push("create");
      return { id: "ann-1" } as AnnotationItem;
    });
    const setShape = vi.fn().mockImplementation(async () => { callOrder.push("setShape"); });
    const setShapes = vi.fn().mockImplementation(async () => { callOrder.push("setShapes"); });
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: {
        type: "idah-image:mask",
        "tile-0x0": { rle: "ABC" },
        "tile-0x1": { rle: "DEF" },
      } as any,
      value: { category: "cat" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    expect(callOrder).toEqual(["create", "setShapes"]);
  });

  it("does not call setShape/setShapes when record has no tile keys", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: { type: "idah-image:bounding-box", x: 10, y: 20, width: 100, height: 200 } as any,
      value: { category: "car" },
    };

    await recreateAnnotationWithTiles(annotations, record);

    expect(create).toHaveBeenCalled();
    expect(setShape).not.toHaveBeenCalled();
    expect(setShapes).not.toHaveBeenCalled();
  });

  it("handles shape being undefined/null without throwing", async () => {
    const create = vi.fn().mockResolvedValue({ id: "ann-1" } as AnnotationItem);
    const setShape = vi.fn();
    const setShapes = vi.fn();
    const annotations = { create, setShape, setShapes };

    const record: AnnotationItem = {
      id: "ann-1",
      shape: undefined as any,
      value: { category: "cat" },
    };

    await expect(
      recreateAnnotationWithTiles(annotations, record),
    ).resolves.toBeUndefined();

    // create() should be called with an empty shape object (the guard: _shape ? ... : {})
    expect(create).toHaveBeenCalledWith({
      id: "ann-1",
      shape: {},
      value: { category: "cat" },
    });
    expect(setShape).not.toHaveBeenCalled();
    expect(setShapes).not.toHaveBeenCalled();
  });
});