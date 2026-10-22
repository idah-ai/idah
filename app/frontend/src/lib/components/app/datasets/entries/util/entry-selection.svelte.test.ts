import { describe, it, expect } from "vitest";

import { EntrySelection } from "./entry-selection.svelte";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

interface MockEntry {
  id: string;
  status?: string;
  wf_step?: string;
  assigned_to_id?: number | null;
  name?: string;
}

function createSelection(entries: MockEntry[], selectedIds: string[]): EntrySelection {
  const controller = {
    response: { data: entries as unknown as EntryRecord[] },
    selectedIds: [...selectedIds],
  } as never;
  return new EntrySelection(controller);
}

describe("EntrySelection", () => {
  describe("selectedEntryRecords", () => {
    it("returns the selected entries in selection order", () => {
      const entries: MockEntry[] = [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
        { id: "3", name: "C" },
      ];
      const sel = createSelection(entries, ["3", "1"]);

      expect(sel.selectedEntryRecords.map((e) => e.id)).toEqual(["3", "1"]);
    });

    it("returns empty array when nothing is selected", () => {
      const entries: MockEntry[] = [{ id: "1", name: "A" }];
      const sel = createSelection(entries, []);

      expect(sel.selectedEntryRecords).toEqual([]);
    });

    it("skips selected ids that are not present in the loaded data", () => {
      const entries: MockEntry[] = [{ id: "1", name: "A" }];
      const sel = createSelection(entries, ["1", "missing"]);

      expect(sel.selectedEntryRecords.map((e) => e.id)).toEqual(["1"]);
    });
  });

  describe("reopenableEntryIds", () => {
    it("returns ids of selected entries whose status is 'completed'", () => {
      const entries: MockEntry[] = [
        { id: "1", status: "completed" },
        { id: "2", status: "in_progress" },
        { id: "3", status: "completed" },
      ];
      const sel = createSelection(entries, ["1", "2", "3"]);

      expect(sel.reopenableEntryIds).toEqual(["1", "3"]);
    });

    it("returns empty array when no completed entries are selected", () => {
      const entries: MockEntry[] = [
        { id: "1", status: "in_progress" },
        { id: "2", status: "pending" },
      ];
      const sel = createSelection(entries, ["1", "2"]);

      expect(sel.reopenableEntryIds).toEqual([]);
    });

    it("returns empty array when no entries are selected", () => {
      const entries: MockEntry[] = [{ id: "1", status: "completed" }];
      const sel = createSelection(entries, []);

      expect(sel.reopenableEntryIds).toEqual([]);
    });

    it("excludes entries not in selection even if completed", () => {
      const entries: MockEntry[] = [
        { id: "1", status: "completed" },
        { id: "2", status: "completed" },
      ];
      const sel = createSelection(entries, ["2"]);

      expect(sel.reopenableEntryIds).toEqual(["2"]);
    });
  });

  describe("assignableEntryIds", () => {
    it("includes non-done entries", () => {
      const entries: MockEntry[] = [
        { id: "1", wf_step: "annotate" },
        { id: "2", wf_step: "done" },
      ];
      const sel = createSelection(entries, ["1", "2"]);

      expect(sel.assignableEntryIds).toEqual(["1"]);
    });
  });

  describe("unAssignableEntryIds", () => {
    it("includes non-done, assigned entries", () => {
      const entries: MockEntry[] = [
        { id: "1", wf_step: "annotate", assigned_to_id: 5 },
        { id: "2", wf_step: "done", assigned_to_id: 5 },
        { id: "3", wf_step: "annotate", assigned_to_id: null },
      ];
      const sel = createSelection(entries, ["1", "2", "3"]);

      expect(sel.unAssignableEntryIds).toEqual(["1"]);
    });
  });
});
