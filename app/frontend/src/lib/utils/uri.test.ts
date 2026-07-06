import { describe, it, expect } from "vitest";
import { snakeCase, encodeUri, filtersToHash, convertSearchParamsToHash } from "./uri";

describe("snakeCase", () => {
  it("converts camelCase to snake_case", () => {
    expect(snakeCase("helloWorld")).toBe("hello_world");
  });

  it("converts multiple humps", () => {
    expect(snakeCase("fooBarBaz")).toBe("foo_bar_baz");
  });

  it("converts space-separated words", () => {
    expect(snakeCase("Hello World")).toBe("hello_world");
  });

  it("leaves an already snake_case string unchanged", () => {
    expect(snakeCase("already_snake")).toBe("already_snake");
  });

  it("lowercases a single word", () => {
    expect(snakeCase("Foo")).toBe("foo");
  });
});

describe("encodeUri", () => {
  it("encodes a flat object", () => {
    expect(encodeUri({ foo: "bar", n: 1 })).toBe("foo=bar&n=1");
  });

  it("url-encodes reserved characters in keys and values", () => {
    expect(encodeUri({ q: "a b&c=d" })).toBe("q=a%20b%26c%3Dd");
  });

  it("encodes array values with []", () => {
    expect(encodeUri({ ids: [1, 2] })).toBe("ids%5B%5D=1&ids%5B%5D=2");
  });

  it("encodes nested objects with [key]", () => {
    expect(encodeUri({ a: { b: "c" } })).toBe("a%5Bb%5D=c");
  });

  it("encodes objects nested inside arrays", () => {
    expect(encodeUri({ tags: [{ id: 1 }] })).toBe("tags%5B%5D%5Bid%5D=1");
  });

  it("returns an empty string for an empty object", () => {
    expect(encodeUri({})).toBe("");
  });
});

describe("filtersToHash", () => {
  it("keeps the key as-is for the eq operator", () => {
    expect(filtersToHash({ name: { op: "eq", value: "John" } })).toEqual({
      name: "John",
    });
  });

  it("suffixes the key with __op for non-eq operators", () => {
    expect(filtersToHash({ age: { op: "gt", value: 18 } })).toEqual({
      age__gt: 18,
    });
  });

  it("serialises multiple distinct filters", () => {
    expect(
      filtersToHash({
        name: { op: "eq", value: "John" },
        age: { op: "gt", value: 18 },
      }),
    ).toEqual({ name: "John", age__gt: 18 });
  });

  it("does not drop single-value filters (regression: FE-010)", () => {
    // Before the fix, filtersToHash returned {} for every input because it
    // never assigned out[key] on first sight of a key.
    const out = filtersToHash({ status: { op: "eq", value: "active" } });
    expect(out).toEqual({ status: "active" });
    expect(Object.keys(out)).toHaveLength(1);
  });

  it("returns an empty object for no filters", () => {
    expect(filtersToHash({})).toEqual({});
  });
});

describe("convertSearchParamsToHash", () => {
  it("extracts the column key + operator from a filters[...] param", () => {
    const params = new URLSearchParams("filters[name__match]=John");
    expect(convertSearchParamsToHash(params)).toEqual({ name__match: "John" });
  });

  it("extracts an operator-less filter key", () => {
    const params = new URLSearchParams("filters[name]=John");
    expect(convertSearchParamsToHash(params)).toEqual({ name: "John" });
  });

  it("keeps only the last value for repeated keys (Object.fromEntries dedupes)", () => {
    // NOTE: convertSearchParamsToHash routes through
    // Object.fromEntries(searchParams.entries()), which collapses duplicate
    // keys to their last value BEFORE the loop runs. Its internal
    // array-collapsing branch is therefore effectively unreachable for
    // URLSearchParams input. This test documents the actual behaviour.
    const params = new URLSearchParams();
    params.append("filters[role__in]", "admin");
    params.append("filters[role__in]", "editor");
    expect(convertSearchParamsToHash(params)).toEqual({ role__in: "editor" });
  });

  it("keeps multiple distinct keys", () => {
    const params = new URLSearchParams("filters[name]=John&filters[age__gt]=18");
    expect(convertSearchParamsToHash(params)).toEqual({
      name: "John",
      age__gt: "18",
    });
  });

  it("ignores params that don't match the listOptions[key] shape", () => {
    const params = new URLSearchParams("page=1&filters[name]=John");
    expect(convertSearchParamsToHash(params)).toEqual({ name: "John" });
  });

  it("returns an empty object when nothing matches", () => {
    const params = new URLSearchParams("page=1&items_per_page=20");
    expect(convertSearchParamsToHash(params)).toEqual({});
  });
});
