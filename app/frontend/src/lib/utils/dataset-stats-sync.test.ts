import { describe, expect, it } from "vitest";

import { categoryIdsChanged, nextStatsSyncState } from "./dataset-stats-sync.svelte";

describe("nextStatsSyncState", () => {
  it("waits through an initial false and completes only after true then false", () => {
    expect(nextStatsSyncState("waiting", false, 1_000)).toBe("waiting");
    expect(nextStatsSyncState("waiting", true, 2_000)).toBe("running");
    expect(nextStatsSyncState("running", false, 3_000)).toBe("complete");
  });

  it("reports an unverified result after ten seconds without seeing true", () => {
    expect(nextStatsSyncState("waiting", false, 10_000)).toBe("unverified");
    expect(nextStatsSyncState("waiting", undefined, 10_000)).toBe("unverified");
  });
});

describe("categoryIdsChanged", () => {
  const config = (ids: string[]) => ({ shape: { values: ids.map((id) => ({ id })) } });

  it("ignores non-category changes", () => {
    expect(categoryIdsChanged(config(["cat"]), { shape: { values: [{ id: "cat", label: "Cat" }] } })).toBe(false);
  });

  it("detects added and removed categories", () => {
    expect(categoryIdsChanged(config(["cat"]), config(["cat", "dog"]))).toBe(true);
    expect(categoryIdsChanged(config(["cat", "dog"]), config(["cat"]))).toBe(true);
  });
});
