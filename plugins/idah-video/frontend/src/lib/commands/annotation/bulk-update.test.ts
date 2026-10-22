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
  });
});
