import { describe, expect, it } from "vitest";
import type { IConfigProperty, IIdahDriverV2 } from "$idah/v2/types";
import { pruneHiddenProperties } from "./prune-hidden-properties";

const field = (id: string) => ({ id } as IConfigProperty);

describe("pruneHiddenProperties", () => {
  it("removes chained hidden values without mutating the input", () => {
    const driver = {
      getFilteredConfig: (_shape: string, value: { properties: Record<string, unknown> }) => ({
        values: [],
        properties: [
          field("occluded"),
          ...(value.properties.occluded === true ? [field("level")] : []),
          ...(value.properties.level === "100" ? [field("note")] : []),
        ],
      }),
    } as unknown as IIdahDriverV2;
    const input = { occluded: false, level: "100", note: "old" };

    expect(pruneHiddenProperties(driver, "box", "vehicle", input)?.properties).toEqual({ occluded: false });
    expect(input).toEqual({ occluded: false, level: "100", note: "old" });
  });

  it("does not discard properties when the shape config is unavailable", () => {
    const driver = { getFilteredConfig: () => undefined } as unknown as IIdahDriverV2;
    expect(pruneHiddenProperties(driver, "missing", "vehicle", { occluded: false })).toBeUndefined();
  });
});
