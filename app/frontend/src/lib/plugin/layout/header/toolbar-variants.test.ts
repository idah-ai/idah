import { describe, expect, it } from "vitest";

import { resolveToolbarText, itemClass, toggledButton, accentButtonClass, accentSubTriggerClass } from "./toolbar-variants";
import type { IToolbarItem } from "@/plugin/v2/types";

function item(extra: Partial<IToolbarItem> = {}): IToolbarItem {
  return { icon: "", label: "", mode: "default", group: null, onClick: () => {}, ...extra };
}

describe("resolveToolbarText", () => {
  it("returns a static string as-is", () => {
    expect(resolveToolbarText("Show")).toBe("Show");
  });

  it("calls a function to get the current value", () => {
    let visible = true;
    const label = () => (visible ? "Hide" : "Show");

    expect(resolveToolbarText(label)).toBe("Hide");
    visible = false;
    expect(resolveToolbarText(label)).toBe("Show");
  });
});

describe("itemClass", () => {
  it("fills a toggled success item solid green", () => {
    expect(itemClass(item({ toggledVariant: "success" }), true)).toContain("bg-green-500 text-white");
  });

  it("fills a toggled destructive item solid red", () => {
    expect(itemClass(item({ toggledVariant: "destructive" }), true)).toContain("bg-destructive text-white");
  });

  it("keeps the solid primary fill for toggled items without a toggledVariant", () => {
    expect(itemClass(item(), true)).toContain("bg-primary text-primary-foreground");
  });

  it("styles an untoggled destructive item with destructive text", () => {
    expect(itemClass(item({ variant: "destructive" }), false)).toContain("text-destructive");
  });

  it("adds no styling to a plain untoggled item", () => {
    expect(itemClass(item(), false)).toBe("");
  });
});

describe("toggledButton", () => {
  it("uses the matching solid button variant for a toned item", () => {
    expect(toggledButton(item({ toggledVariant: "success" }))).toEqual({ variant: "success", class: "" });
    expect(toggledButton(item({ toggledVariant: "destructive" }))).toEqual({ variant: "destructive", class: "" });
  });

  it("keeps the default solid button for items without a tone", () => {
    expect(toggledButton(item())).toEqual({ variant: "default", class: "" });
    expect(toggledButton(undefined)).toEqual({ variant: "default", class: "" });
  });
});

describe("group accent", () => {
  it("tints a success-accented group button light green", () => {
    const cls = accentButtonClass("success");
    expect(cls).toContain("bg-green-500/15");
    expect(cls).toContain("text-green-700");
  });

  it("tints a destructive-accented group button light red", () => {
    expect(accentButtonClass("destructive")).toContain("bg-destructive/10");
  });

  it("defaults to the success tint", () => {
    expect(accentButtonClass(undefined)).toBe(accentButtonClass("success"));
  });

  it("tints a nested group's sub-trigger the same way", () => {
    expect(accentSubTriggerClass("success")).toContain("bg-green-500/15");
  });
});
