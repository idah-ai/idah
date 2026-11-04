import { describe, expect, it } from "vitest";

import type { EntryStatRecord } from "@/data/model/dataset/entry-stats/record";
import { orphanCountsByEntry } from "./orphan-counts";

describe("orphanCountsByEntry", () => {
  it("maps the page's orphan stats by entry and leaves missing rows at zero", () => {
    const stats = [{ entry_id: "one", value: "2" }] as EntryStatRecord[];
    expect(orphanCountsByEntry(["one", "two"], stats)).toEqual({ one: 2, two: 0 });
  });
});
