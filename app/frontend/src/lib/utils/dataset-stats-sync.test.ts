import { describe, expect, it } from "vitest";

import { statsSyncPollDelay } from "./dataset-stats-sync.svelte";

describe("statsSyncPollDelay", () => {
  it("polls every second for the first 30 seconds", () => {
    expect(statsSyncPollDelay(0)).toBe(1_000);
    expect(statsSyncPollDelay(29_999)).toBe(1_000);
  });

  it("backs off to 5 seconds, then 15 seconds for long sweeps", () => {
    expect(statsSyncPollDelay(30_000)).toBe(5_000);
    expect(statsSyncPollDelay(119_999)).toBe(5_000);
    expect(statsSyncPollDelay(120_000)).toBe(15_000);
    expect(statsSyncPollDelay(600_000)).toBe(15_000);
  });
});
