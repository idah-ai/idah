// ---------------------------------------------------------------------------
// history-days.test.ts — day grouping for the History panel.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { groupChangesByDay } from "./history-days";
import type { IAnnotationChange } from "$idah/v2/types";

function change(id: string, changed_at: number): IAnnotationChange {
  return {
    id,
    annotation_id: "a-1",
    account_id: 1,
    account_email: "u@example.com",
    op: "updated",
    version: 2,
    changed_at,
  };
}

// Local noon on 2026-11-03 (a Tuesday), so day boundaries are unambiguous.
const NOW = new Date(2026, 10, 3, 12, 0, 0).getTime();

describe("groupChangesByDay", () => {
  it("labels today, yesterday and older dates", () => {
    const today = change("today", NOW);
    const yesterday = change("yesterday", NOW - 86_400_000);
    const older = change("older", NOW - 3 * 86_400_000);

    const groups = groupChangesByDay([today, yesterday, older], new Date(NOW));

    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      new Date(NOW - 3 * 86_400_000).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ]);
    expect(groups[0].items.map((c) => c.id)).toEqual(["today"]);
    expect(groups[1].items.map((c) => c.id)).toEqual(["yesterday"]);
    expect(groups[2].items.map((c) => c.id)).toEqual(["older"]);
  });

  it("groups consecutive changes on the same day under one heading", () => {
    const a = change("a", NOW);
    const b = change("b", NOW - 60_000);
    const c = change("c", NOW - 86_400_000);

    const groups = groupChangesByDay([a, b, c], new Date(NOW));

    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
    expect(groups[0].items.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("handles a page that spans midnight", () => {
    // 23:59 yesterday vs 00:01 today.
    const lateYesterday = change("late", NOW - 86_400_000 + 60_000);
    const earlyToday = change("early", NOW - 60_000);

    const groups = groupChangesByDay([earlyToday, lateYesterday], new Date(NOW));

    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
  });
});
