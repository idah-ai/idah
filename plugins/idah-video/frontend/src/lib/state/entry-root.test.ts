// ---------------------------------------------------------------------------
// entry-root.test.ts — Unit tests for entry-root annotation state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { entryRoot } from "./entry-root.svelte";

describe("entryRoot state", () => {
  beforeEach(() => {
    entryRoot.value = undefined;
  });

  it("starts as undefined", () => {
    expect(entryRoot.value).toBeUndefined();
  });

  it("can be set to an object", () => {
    const root = { id: "root-001", value: { category: "scene" } };
    entryRoot.value = root;
    expect(entryRoot.value).toBe(root);
  });

  it("can be set to null", () => {
    entryRoot.value = null;
    expect(entryRoot.value).toBeNull();
  });

  it("can be set back to undefined", () => {
    entryRoot.value = { id: "root-001" };
    entryRoot.value = undefined;
    expect(entryRoot.value).toBeUndefined();
  });

  it("replaces a previous value", () => {
    entryRoot.value = { id: "root-001" };
    entryRoot.value = { id: "root-002" };
    expect(entryRoot.value).toEqual({ id: "root-002" });
  });

  it("holds arbitrary data", () => {
    const data = { id: "x", shape: { type: "entry:root" }, value: { label: "test" } };
    entryRoot.value = data;
    expect(entryRoot.value).toEqual(data);
  });
});