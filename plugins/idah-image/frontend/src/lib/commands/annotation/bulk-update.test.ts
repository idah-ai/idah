import { beforeEach, describe, expect, it, vi } from "vitest";

const items = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const locked = vi.hoisted(() => new Set<string>());
const update = vi.hoisted(() => vi.fn(async (next: Record<string, unknown>) => {
  const index = items.findIndex((item) => item.id === next.id);
  items[index] = next;
}));

vi.mock("$lib/state/data.svelte", () => ({ data: { annotations: { items, update } } }));
vi.mock("$lib/state/annotation.svelte", () => ({ annotation: { isLocked: (item: { id: string }) => locked.has(item.id), isHidden: () => false } }));
vi.mock("$lib/state/editor.svelte", () => ({ isEditable: () => true }));
vi.mock("..", () => ({ noopAction: (command: object) => ({ command, do() {}, isCombinable: () => false, combine: (previous: object) => previous }) }));

import { register } from "./bulk-update";

const shape = "idah-image:bounding-box";
const mask = "idah-image:mask";
const original = () => [
  { id: "a", shape_type: shape, shape_args: { points: [1] }, category: "vehicle", properties: { occluded: "No" } },
  { id: "b", shape_type: shape, shape_args: { points: [2] }, category: "pedestrian", properties: { occluded: "Yes", crossing: "Yes" } },
];

describe("annotation.bulk-update", () => {
  beforeEach(() => {
    items.splice(0, items.length, ...original());
    locked.clear();
    update.mockClear();
  });

  it("updates every category and restores all previous values with one undo", async () => {
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: { occluded: "No" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ] });

    await action.do();
    expect(items.map((item) => item.category)).toEqual(["vehicle", "vehicle"]);
    expect(items[1].properties).toEqual({ occluded: "Yes" });
    expect(items.map((item) => item.shape_args)).toEqual([{ points: [1] }, { points: [2] }]);
    await action.undo();
    expect(items).toEqual(original());
    expect(update).toHaveBeenCalledTimes(4);
  });

  it("applies a property-only update while preserving each category and other values", async () => {
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [
      { id: "vehicle" }, { id: "pedestrian" },
    ] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: { occluded: "Yes" } },
      { id: "b", category: "pedestrian", properties: { occluded: "Yes", crossing: "Yes" } },
    ] });

    await action.do();
    expect(items.map((item) => item.category)).toEqual(["vehicle", "pedestrian"]);
    expect(items.map((item) => item.properties)).toEqual([
      { occluded: "Yes" }, { occluded: "Yes", crossing: "Yes" },
    ]);
    await action.undo();
    expect(items).toEqual(original());
  });

  it("does not write when a target is locked", async () => {
    locked.add("b");
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ] });
    await action.do();
    expect(update).not.toHaveBeenCalled();
    expect(items).toEqual(original());
  });

  it("does not write if a target becomes locked before the action runs", async () => {
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ] });
    locked.add("b");

    await action.do();
    expect(update).not.toHaveBeenCalled();
    expect(items).toEqual(original());
    await action.undo();
    expect(update).not.toHaveBeenCalled();
  });

  it("updates mixed shape types when each supports its target category", async () => {
    const polygon = "idah-image:polygon";
    items[1] = { ...items[1], shape_type: polygon };
    const before = structuredClone(items);
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: {
      [shape]: { values: [{ id: "vehicle" }] },
      [polygon]: { values: [{ id: "vehicle" }] },
    } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: { occluded: "No" } },
      { id: "b", category: "vehicle", properties: { occluded: "Yes" } },
    ] });

    await action.do();
    expect(items.map((item) => item.category)).toEqual(["vehicle", "vehicle"]);
    expect(update).toHaveBeenCalledTimes(2);
    await action.undo();
    expect(items).toEqual(before);
  });

  it("rejects all targets when one shape does not support its target category", async () => {
    const polygon = "idah-image:polygon";
    items[1] = { ...items[1], shape_type: polygon };
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: {
      [shape]: { values: [{ id: "vehicle" }] },
      [polygon]: { values: [{ id: "pedestrian" }] },
    } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ] });

    await action.do();
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks a mask category collision before writing", async () => {
    items.splice(0, items.length,
      { id: "a", shape_type: mask, shape_args: {}, category: "road", properties: {} },
      { id: "b", shape_type: mask, shape_args: {}, category: "sidewalk", properties: {} },
    );
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [mask]: { values: [{ id: "sidewalk" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "sidewalk", properties: {} },
    ] });

    await action.do();
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks two selected masks from receiving the same category", async () => {
    items.splice(0, items.length,
      { id: "a", shape_type: mask, shape_args: {}, category: "road", properties: {} },
      { id: "b", shape_type: mask, shape_args: {}, category: "sidewalk", properties: {} },
    );
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [mask]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ] });

    await action.do();
    expect(update).not.toHaveBeenCalled();
  });

  it("rechecks mask collisions before a queued action writes", async () => {
    items.splice(0, items.length,
      { id: "a", shape_type: mask, shape_args: {}, category: "road", properties: {} },
      { id: "b", shape_type: mask, shape_args: {}, category: "sidewalk", properties: {} },
    );
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [mask]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
    ] });
    items.push({ id: "c", shape_type: mask, shape_args: {}, category: "vehicle", properties: {} });

    await action.do();
    await action.undo();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows property-only edits to masks with distinct categories", async () => {
    items.splice(0, items.length,
      { id: "a", shape_type: mask, shape_args: {}, category: "road", properties: { surface: "Dry" } },
      { id: "b", shape_type: mask, shape_args: {}, category: "sidewalk", properties: { surface: "Wet" } },
    );
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [mask]: { values: [{ id: "road" }, { id: "sidewalk" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "road", properties: { surface: "Dry" } },
      { id: "b", category: "sidewalk", properties: { surface: "Dry" } },
    ] });

    await action.do();
    expect(items.map((item) => item.category)).toEqual(["road", "sidewalk"]);
    expect(items.map((item) => item.properties)).toEqual([{ surface: "Dry" }, { surface: "Dry" }]);
  });

  it("allows distinct mask categories and preserves them on undo", async () => {
    items.splice(0, items.length,
      { id: "a", shape_type: mask, shape_args: {}, category: "road", properties: { note: "A" } },
      { id: "b", shape_type: mask, shape_args: {}, category: "sidewalk", properties: { note: "B" } },
    );
    const before = structuredClone(items);
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [mask]: { values: [{ id: "road" }, { id: "sidewalk" }, { id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: { note: "A" } },
    ] });

    await action.do();
    expect(items[0].category).toBe("vehicle");
    await action.undo();
    expect(items).toEqual(before);
  });
});
