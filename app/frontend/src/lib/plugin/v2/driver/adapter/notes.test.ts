import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/data/model/dataset/notes/feeds/record", () => ({ noteFeedsBackendDataSource: { list } }));

import { NotesDriverAdapter } from "./notes";

describe("NotesDriverAdapter note selection", () => {
  beforeEach(() => list.mockReset());

  it("keeps feedback keys on a note selected from the canvas", async () => {
    list.mockResolvedValueOnce({
      data: [
        {
          id: "note-1",
          annotation_id: null,
          anchor_type: "entry",
          position: { x: 0.5, y: 0.5 },
          content_md: null,
          feedback_keys: ["missing-annotation", "incorrect-label"],
          status: "pending",
        },
      ],
    });
    const adapter = new NotesDriverAdapter("entry-1");
    await adapter.fetchForEntry();

    let selectedFeedbackKeys: string[] | null | undefined;
    adapter.onNoteSelection((noteId) => {
      selectedFeedbackKeys = noteId ? adapter.getNote(noteId)?.feedback_keys : undefined;
    });
    adapter.selectNote("note-1");

    expect(selectedFeedbackKeys).toEqual(["missing-annotation", "incorrect-label"]);
  });
});
