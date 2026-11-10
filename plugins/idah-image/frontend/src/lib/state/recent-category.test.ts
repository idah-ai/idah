import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recentCategory } from "./recent-category";

const KEY = "idah-image:recent-category:ds-1";

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
  };
}

const driver = (datasetId = "ds-1") => ({ dataset: { id: datasetId } }) as any;

describe("recentCategory", () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    recentCategory.reset();
    storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has nothing before a category is used", () => {
    expect(recentCategory.get(driver())).toBeUndefined();
  });

  it("saves to localStorage, keyed by dataset", () => {
    recentCategory.record(driver(), "vehicle/car", "box");
    expect(recentCategory.get(driver())).toEqual({ category: "vehicle/car", shapeType: "box" });
    expect(JSON.parse(storage.items.get(KEY)!)).toEqual({ category: "vehicle/car", shapeType: "box" });
  });

  it("reads the saved category after a reload", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [KEY]: JSON.stringify({ category: "person", shapeType: "polygon" }) }));
    expect(recentCategory.get(driver())).toEqual({ category: "person", shapeType: "polygon" });
  });

  it("keeps each dataset separate", () => {
    recentCategory.record(driver("ds-1"), "vehicle/car", "box");
    expect(recentCategory.get(driver("ds-2"))).toBeUndefined();
  });

  it("ignores an empty category and a malformed saved value", () => {
    vi.stubGlobal("localStorage", fakeStorage({ [KEY]: "{not json" }));
    recentCategory.record(driver(), "", "box");
    expect(recentCategory.get(driver())).toBeUndefined();
  });

  it("keeps working in memory when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    recentCategory.record(driver(), "vehicle/car", "box");
    expect(recentCategory.get(driver())?.category).toBe("vehicle/car");
  });
});
