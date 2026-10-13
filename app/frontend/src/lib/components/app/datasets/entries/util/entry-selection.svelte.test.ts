import { describe, it, expect } from "vitest";

import { EntrySelection } from "./entry-selection.svelte";

function createSelection(entries: Array<{ id: string; status: string }>, selectedIds: string[]): EntrySelection {
  const controller = {
    response: { data: entries },
    selectedIds: [...selectedIds],
  } as never;
  return new EntrySelection(controller);
}

describe("EntrySelection", () => {
  describe("reopenableEntryIds", () => {
    it("returns ids of selected entries whose status is 'completed'", () => {
      const entries = [
        { id: "1", status: "completed" },
        { id: "2", status: "in_progress" },
        { id: "3", status: "completed" },
      ];
      const sel = createSelection(entries, ["1", "2", "3"]);

      expect(sel.reopenableEntryIds).toEqual(["1", "3"]);
    });

    it("returns empty array when no completed entries are selected", () => {
      const entries = [
        { id: "1", status: "in_progress" },
        { id: "2", status: "pending" },
      ];
      const sel = createSelection(entries, ["1", "2"]);

      expect(sel.reopenableEntryIds).toEqual([]);
    });

    it("returns empty array when no entries are selected", () => {
      const entries = [{ id: "1", status: "completed" }];
      const sel = createSelection(entries, []);

      expect(sel.reopenableEntryIds).toEqual([]);
    });

    it("excludes entries not in selection even if completed", () => {
      const entries = [
        { id: "1", status: "completed" },
        { id: "2", status: "completed" },
      ];
      const sel = createSelection(entries, ["2"]);

      expect(sel.reopenableEntryIds).toEqual(["2"]);
    });
  });

  describe("assignableEntryIds", () => {
    it("includes non-done entries", () => {
      const entries = [
        { id: "1", wf_step: "annotate" },
        { id: "2", wf_step: "done" },
      ];
      const sel = createSelection(entries as any, ["1", "2"]);

      expect(sel.assignableEntryIds).toEqual(["1"]);
    });
  });

  describe("unAssignableEntryIds", () => {
    it("includes non-done, assigned entries", () => {
      const entries = [
        { id: "1", wf_step: "annotate", assigned_to_id: 5 },
        { id: "2", wf_step: "done", assigned_to_id: 5 },
        { id: "3", wf_step: "annotate", assigned_to_id: null },
      ];
      const sel = createSelection(entries as any, ["1", "2", "3"]);

      expect(sel.unAssignableEntryIds).toEqual(["1"]);
    });
  });
});