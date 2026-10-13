import { describe, it, expect } from "vitest";

import { getEntryDropdownMenuActions } from "./entry-dropdown-menu";

describe("getEntryDropdownMenuActions", () => {
  const defaultParams = {
    onAssign: () => {},
    onUnassign: () => {},
    onSetPriority: () => {},
    onDelete: () => {},
    isAssigned: false,
    isAssignDisabled: false,
    isUnassignDisabled: false,
  };

  it("returns all default actions", () => {
    const items = getEntryDropdownMenuActions(defaultParams);

    expect(items).toHaveLength(4);
    expect(items[0].label).toBe("Assign to");
    expect(items[1].label).toBe("Unassign");
    expect(items[2].label).toBe("Set Priority");
    expect(items[3].label).toBe("Delete");
  });

  it("includes a Reopen action when onReopen is provided", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      onReopen: () => {},
    });

    expect(items).toHaveLength(5);
    expect(items[2].label).toBe("Set Priority");
    expect(items[3].label).toBe("Reopen");
    expect(items[3].hidden).toBeUndefined();
    expect(items[3].disabled).toBeUndefined();
  });

  it("hides Reopen when isReopenHidden is true", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      onReopen: () => {},
      isReopenHidden: true,
    });

    const reopenItem = items.find((i) => i.label === "Reopen");
    expect(reopenItem?.hidden).toBe(true);
  });

  it("disables Reopen when isReopenDisabled is true", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      onReopen: () => {},
      isReopenDisabled: true,
    });

    const reopenItem = items.find((i) => i.label === "Reopen");
    expect(reopenItem?.disabled).toBe(true);
  });

  it("hides Unassign when isAssigned is false", () => {
    const items = getEntryDropdownMenuActions(defaultParams);

    const unassignItem = items.find((i) => i.label === "Unassign");
    expect(unassignItem?.hidden).toBe(true);
  });

  it("shows Unassign when isAssigned is true", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      isAssigned: true,
    });

    const unassignItem = items.find((i) => i.label === "Unassign");
    expect(unassignItem?.hidden).toBe(false);
  });
});
