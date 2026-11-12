// ---------------------------------------------------------------------------
// sheet.service.test.ts — the app-wide stack of sheets and side panels
// ---------------------------------------------------------------------------

import { describe, it, expect, afterEach } from "vitest";
import { closeAllSheets, closeSheet, getSheet, openSheet, sheetStore } from "./sheet.service.svelte";

import type { Component } from "svelte";

const Body = (() => {}) as unknown as Component;
const sheet = (id: string, kind?: "modal" | "panel", title = id) => ({ id, title, component: Body, kind });

describe("sheet service", () => {
  afterEach(() => closeAllSheets());

  it("keeps modal sheets (the default) and panels apart, showing the latest panel", () => {
    openSheet(sheet("templates"));
    openSheet(sheet("help", "panel"));
    openSheet(sheet("notes", "panel"));

    expect(sheetStore.modals.map((s) => s.id)).toEqual(["templates"]);
    expect(sheetStore.panel?.id).toBe("notes");

    closeSheet("notes");
    expect(sheetStore.panel?.id).toBe("help"); // the earlier panel shows again
  });

  it("replaces a sheet opened again under the same id, keeping its place", () => {
    openSheet(sheet("help", "panel", "Uploading"));
    openSheet(sheet("other"));
    openSheet(sheet("help", "panel", "Exporting"));

    expect(sheetStore.stack.map((s) => s.id)).toEqual(["help", "other"]);
    expect(getSheet("help")?.title).toBe("Exporting");
  });

  it("reports whether a panel is open", () => {
    openSheet(sheet("templates"));
    expect(sheetStore.panelOpen).toBe(false);

    openSheet(sheet("help", "panel"));
    expect(sheetStore.panelOpen).toBe(true);
  });
});
