import { beforeEach, describe, expect, it, vi } from "vitest";

const items = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const update = vi.hoisted(() => vi.fn(async (next: Record<string, unknown>) => {
  const index = items.findIndex((item) => item.id === next.id);
  items[index] = next;
}));

vi.mock("$lib/state/data.svelte", () => ({ data: { annotations: { items, update } } }));
vi.mock("$lib/state/editor.svelte", () => ({ isEditable: () => true }));
vi.mock("..", () => ({ noopAction: (command: object) => ({ command, do() {}, isCombinable: () => false, combine: (previous: object) => previous }) }));

import { register } from "./updateGroupCategory";

describe("annotation.update-group-category", () => {
  beforeEach(() => {
    items.splice(0, items.length,
      { id: "a", shape_type: "box", category: "old", properties: { occluded: false, level: "100" }, metadata: { group_id: "group" } },
      { id: "b", shape_type: "box", category: "old", properties: { occluded: true, level: "50" }, metadata: { group_id: "group" } },
    );
    update.mockClear();
  });

  it("cleans hidden values and restores them on undo", async () => {
    const registerCommand = vi.fn();
    register({
      command: { register: registerCommand },
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [], properties: [
          { id: "occluded" },
          ...(value.properties.occluded === true ? [{ id: "level" }] : []),
        ],
      }),
    } as any);
    const action = registerCommand.mock.calls[0][0].callback({ groupId: "group", categoryIdToBeUpdate: "new" });

    await action.do();
    expect(items.map((item) => item.properties)).toEqual([
      { occluded: false }, { occluded: true, level: "50" },
    ]);
    await action.undo();
    expect(items.map((item) => item.properties)).toEqual([
      { occluded: false, level: "100" }, { occluded: true, level: "50" },
    ]);
    expect(items.map((item) => item.category)).toEqual(["old", "old"]);
  });
});
