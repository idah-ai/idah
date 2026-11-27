import { describe, expect, it } from "vitest";
import { TimeStatsProvider } from "./time-stats";
import type { IIdahDriverV2 } from "../../types";

function createMockDriver(overrides: Partial<IIdahDriverV2> = {}): IIdahDriverV2 {
  return {
    timeTracking: null,
    workTimes: [],
    ...overrides,
  } as unknown as IIdahDriverV2;
}

describe("TimeStatsProvider", () => {
  it("returns empty array when no time tracking data exists", () => {
    const provider = new TimeStatsProvider(createMockDriver());
    expect(provider.collect()).toEqual([]);
  });

  it("returns a single entry for one step with seconds", () => {
    const provider = new TimeStatsProvider(createMockDriver({ timeTracking: { annotate: 3600 } }));
    const stats = provider.collect();
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      key: "time.annotate.total",
      value: "01:00:00",
      label: "Annotate",
    });
  });

  it("returns multiple entries for multiple steps", () => {
    const provider = new TimeStatsProvider(createMockDriver({ timeTracking: { annotate: 1800, review: 900 } }));
    const stats = provider.collect();
    expect(stats).toHaveLength(2);
    expect(stats[0].key).toBe("time.annotate.total");
    expect(stats[1].key).toBe("time.review.total");
  });

  it("includes per-author rows from workTimes", () => {
    const provider = new TimeStatsProvider(
      createMockDriver({
        timeTracking: { annotate: 600 },
        workTimes: [
          { wfStep: "annotate", accountId: 1, email: "alice@test.com", seconds: 600, sessionStartedAt: null },
        ],
      }),
    );
    const stats = provider.collect();
    // step total + 1 author row
    expect(stats).toHaveLength(2);
    expect(stats[1]).toMatchObject({
      key: "time.annotate.1",
      value: "00:10:00",
      label: "alice@test.com",
    });
  });

  it("marks unsubmitted work times with — and a danger tag", () => {
    const provider = new TimeStatsProvider(
      createMockDriver({
        workTimes: [
          { wfStep: "annotate", accountId: 1, email: "bob@test.com", seconds: 0, sessionStartedAt: new Date() },
        ],
      }),
    );
    const stats = provider.collect();
    expect(stats).toHaveLength(1);
    expect(stats[0].value).toBe("—");
    expect(stats[0].tags).toEqual([{ label: "Unsubmitted", variant: "destructive" }]);
  });

  it("groups duplicate work times for the same (wfStep, accountId) and sums seconds", () => {
    const provider = new TimeStatsProvider(
      createMockDriver({
        workTimes: [
          { wfStep: "annotate", accountId: 1, email: "admin@idah.ai", seconds: 300, sessionStartedAt: null },
          { wfStep: "annotate", accountId: 1, email: "admin@idah.ai", seconds: 200, sessionStartedAt: null },
        ],
      }),
    );
    const stats = provider.collect();
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      key: "time.annotate.1",
      value: "00:08:20", // 500 seconds
      label: "admin@idah.ai",
    });
  });
});
