import { describe, expect, it } from "vitest";
import { enrichWithTimeData } from "./_OpenEntriesCardV2.table";
import type { EntryRecord } from "@/data/model/dataset/entries/record";
import type { EntryWorkTimeRecord } from "@/data/model/dataset/entry-work-times/record";

type MockEntry = Partial<EntryRecord> & {
  id: string;
  time_tracking: Record<string, number> | null;
  entry_work_times?: EntryWorkTimeRecord[];
  assigned_to_email: string | null;
  wf_step: string;
};

function mockEntry(overrides: Partial<MockEntry> = {}): EntryRecord {
  return {
    id: "entry-1",
    time_tracking: null,
    entry_work_times: [],
    assigned_to_email: "assignee@test.com",
    wf_step: "annotate",
    ...overrides,
  } as unknown as EntryRecord;
}

describe("enrichWithTimeData", () => {
  it("returns zeros and empty steps when no time data exists", () => {
    const result = enrichWithTimeData(mockEntry());
    expect(result.totalSeconds).toBe(0);
    expect(result.steps).toEqual([]);
  });

  it("computes totalSeconds from time_tracking cache", () => {
    const result = enrichWithTimeData(mockEntry({ time_tracking: { annotate: 1800, review: 600 } }));
    expect(result.totalSeconds).toBe(2400);
  });

  it("creates a step per entry in time_tracking", () => {
    const result = enrichWithTimeData(mockEntry({ time_tracking: { annotate: 1800, review: 600 } }));
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].stage).toBe("Annotate");
    expect(result.steps[0].seconds).toBe(1800);
    expect(result.steps[1].stage).toBe("Review");
    expect(result.steps[1].seconds).toBe(600);
  });

  it("sorts steps by workflow order", () => {
    const result = enrichWithTimeData(mockEntry({ time_tracking: { review: 600, annotate: 1800, start: 300 } }));
    expect(result.steps.map((s) => s.stage)).toEqual(["Start", "Annotate", "Review"]);
  });

  it("includes per-person breakdown from entry_work_times", () => {
    const workTimes = [
      { account_id: 1, wf_step: "annotate", seconds: 400, email: "alice@test.com" },
      { account_id: 2, wf_step: "annotate", seconds: 200, email: "bob@test.com" },
    ] as unknown as EntryWorkTimeRecord[];

    const result = enrichWithTimeData(
      mockEntry({
        time_tracking: { annotate: 600 },
        entry_work_times: workTimes,
      }),
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].people).toBeDefined();
    expect(result.steps[0].people).toHaveLength(2);
  });

  it("shows unsubmitted sessions from entry_work_times with non-null session_started_at", () => {
    const workTimes = [
      { account_id: 1, wf_step: "annotate", seconds: 0, email: "bob@test.com", session_started_at: new Date() },
    ] as unknown as EntryWorkTimeRecord[];

    const result = enrichWithTimeData(
      mockEntry({
        time_tracking: null,
        entry_work_times: workTimes,
      }),
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].seconds).toBe(0);
    expect(result.steps[0].stage).toBe("Annotate");
    expect(result.steps[0].people).toBeDefined();
    expect(result.steps[0].people![0].unsubmitted).toBe(true);
  });

  it("shows 'Unsubmitted' for an open session on a step with no finalized time", () => {
    const result = enrichWithTimeData(
      mockEntry({
        time_tracking: null,
        wf_step: "review",
        assigned_to_email: "reviewer@test.com",
        entry_work_times: [
          { account_id: 2, wf_step: "review", seconds: 0, email: "reviewer@test.com", session_started_at: new Date() },
        ] as unknown as EntryWorkTimeRecord[],
      }),
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stage).toBe("Review");
    expect(result.steps[0].seconds).toBe(0);
    // Always has people when unsubmitted
    expect(result.steps[0].people).toHaveLength(1);
    expect(result.steps[0].people![0].unsubmitted).toBe(true);
  });

  it("shows both finalized time and unsubmitted status when the same reviewer has both", () => {
    const result = enrichWithTimeData(
      mockEntry({
        time_tracking: { review: 14 },
        wf_step: "review",
        assigned_to_email: "reviewer@test.com",
        entry_work_times: [
          { account_id: 2, wf_step: "review", seconds: 14, email: "reviewer@test.com", session_started_at: null },
          { account_id: 2, wf_step: "review", seconds: 0, email: "reviewer@test.com", session_started_at: new Date() },
        ] as unknown as EntryWorkTimeRecord[],
      }),
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stage).toBe("Review");
    expect(result.steps[0].seconds).toBe(14);
    expect(result.steps[0].people).toHaveLength(1);
    expect(result.steps[0].people![0].seconds).toBe(14);
    expect(result.steps[0].people![0].unsubmitted).toBe(true);
  });

  it("handles entry with no assigned email gracefully", () => {
    const result = enrichWithTimeData(
      mockEntry({
        assigned_to_email: null,
        time_tracking: { annotate: 120 },
      }),
    );
    expect(result.totalSeconds).toBe(120);
    expect(result.steps[0].performedBy).toBe("Unassigned");
  });
});
