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
vi.mock("$lib/state/viewport.svelte", () => ({ viewport: { isReviewWorkspace: false } }));
vi.mock("..", () => ({ noopAction: (command: object) => ({ command, do() {}, isCombinable: () => false, combine: (previous: object) => previous }) }));

import { register } from "./bulk-update";

const shape = "idah-video:bounding-box";
const original = () => [
  { id: "a", shape_type: shape, shape_args: { start: 0, end: 1 }, category: "vehicle", properties: { occluded: "No" } },
  { id: "b", shape_type: shape, shape_args: { start: 2, end: 3 }, category: "pedestrian", properties: { occluded: "Yes", crossing: "Yes" } },
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
    expect(items.map((item) => item.shape_args)).toEqual([{ start: 0, end: 1 }, { start: 2, end: 3 }]);
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

  it("rejects mixed shape types even when they share a category ID", async () => {
    const polygon = "idah-video:polygon";
    items[1] = { ...items[1], shape_type: polygon };
    items[1] = { ...items[1], category: "vehicle" };
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
    expect(items).toEqual(before);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not write if a target changes shape before the action runs", async () => {
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: [
      { id: "a", category: "vehicle", properties: {} },
      { id: "b", category: "vehicle", properties: {} },
    ] });
    items[1] = { ...items[1], shape_type: "idah-video:polygon" };

    await action.do();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects mixed shape types in an off-frame group member", async () => {
    items.push({ id: "off-frame", shape_type: "idah-video:polygon", shape_args: { start: 100, end: 101 },
      category: "vehicle", properties: {}, metadata: { group_id: "track-7" } });
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: {
      [shape]: { values: [{ id: "vehicle" }] },
      "idah-video:polygon": { values: [{ id: "vehicle" }] },
    } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: items.map((item) => ({
      id: item.id, category: "vehicle", properties: {},
    })) });

    await action.do();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects all targets when one shape does not support its target category", async () => {
    const polygon = "idah-video:polygon";
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

  it("updates an off-frame group member with the others and restores all three on Undo", async () => {
    items.splice(0, items.length,
      { ...original()[0], metadata: { group_id: "track-7" } },
      { ...original()[1], metadata: { group_id: "track-7" } },
      { id: "off-frame", shape_type: shape, shape_args: { start: 100, end: 101 },
        category: "pedestrian", properties: { occluded: "No" }, metadata: { group_id: "track-7" } },
    );
    const before = structuredClone(items);
    const registerCommand = vi.fn();
    register({ command: { register: registerCommand }, config: { [shape]: { values: [{ id: "vehicle" }] } } } as any);
    const action = registerCommand.mock.calls[0][0].callback({ updates: items.map((item) => ({
      id: item.id, category: "vehicle", properties: item.properties,
    })) });

    await action.do();
    expect(items.map((item) => item.category)).toEqual(["vehicle", "vehicle", "vehicle"]);
    expect(update).toHaveBeenCalledTimes(3);
    await action.undo();
    expect(items).toEqual(before);
    expect(update).toHaveBeenCalledTimes(6);
  });
});
