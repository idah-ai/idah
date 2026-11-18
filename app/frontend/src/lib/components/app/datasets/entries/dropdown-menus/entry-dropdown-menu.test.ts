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

    expect(items).toHaveLength(6);
    expect(items[0].label).toBe("Assign to");
    expect(items[1].label).toBe("Unassign");
    expect(items[2].label).toBe("Set Priority");
    expect(items[3].label).toBe("Export");
    expect(items[4].label).toBe("Reopen");
    expect(items[4].hidden).toBeUndefined();
    expect(items[5].label).toBe("Delete");
  });

  it("includes the Export action when onExport is provided", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      onExport: () => {},
    });

    const exportItem = items.find((i) => i.label === "Export");
    expect(exportItem).toBeDefined();
    expect(exportItem?.action).toBeTypeOf("function");
  });

  it("hides Export when isExportHidden is true", () => {
    const items = getEntryDropdownMenuActions({
      ...defaultParams,
      onExport: () => {},
      isExportHidden: true,
    });

    const exportItem = items.find((i) => i.label === "Export");
    expect(exportItem?.hidden).toBe(true);
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
