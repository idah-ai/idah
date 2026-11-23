// ---------------------------------------------------------------------------
// coverage-mask.test.ts — Done Area add / remove / hide / exit behaviour
//
// Covers leaving a drawing tool before add/remove turns on, add/remove and
// clear showing a hidden Done Area, hiding leaving add/remove, the Escape exit
// command only being active during add/remove, and Selection (D) leaving
// add/remove while already in the resting mode.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

const { ui } = vi.hoisted(() => ({
  ui: { coverageMaskActive: false, coverageMaskIsRemove: false, coverageMaskVisible: true },
}));

vi.mock("$lib/state/ui.svelte", () => ({ ui }));
vi.mock("$lib/state/editor.svelte", () => ({ isEditable: () => true }));

import { doAdd, doRemove, hideMask, registerCoverageModeWatcher } from "./_shared";
import { register as registerAdd } from "./add";
import { register as registerRemove } from "./remove";
import { register as registerExit } from "./exit";
import { register as registerToggleVisibility } from "./toggle-visibility";
import { register as registerSelect } from "../mode/select";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, REVIEW_MODE } from "$lib/types";
import type { IIdahDriverV2 } from "$idah/v2/types";

interface Registered {
  activeWhen?: () => boolean;
  callback: () => { do(): unknown };
}

/** Minimal driver: setMode notifies listeners synchronously, like the real one. */
function makeDriver(mode: string) {
  const listeners: Array<() => void> = [];
  const commands = new Map<string, Registered>();
  const driver = {
    mode,
    setMode: vi.fn((next: string) => {
      if (next === driver.mode) return;
      driver.mode = next;
      listeners.forEach((fn) => fn());
    }),
    onModeChange: (fn: () => void) => listeners.push(fn),
    settings: { invalidate: vi.fn() },
    toolbar: { invalidate: vi.fn() },
    command: { register: (opts: Registered & { name: string }) => commands.set(opts.name, opts) },
  };
  registerCoverageModeWatcher(driver as unknown as IIdahDriverV2);
  const run = (name: string) => commands.get(name)!.callback().do();
  return { driver, commands, run };
}

beforeEach(() => {
  ui.coverageMaskActive = false;
  ui.coverageMaskIsRemove = false;
  ui.coverageMaskVisible = true;
});

describe("add / remove", () => {
  it("switches a drawing tool off before add turns on", () => {
    const { driver } = makeDriver(IMAGE_BOUNDING_BOX);

    doAdd(driver);

    expect(driver.setMode).toHaveBeenCalledWith(DEFAULT_MODE);
    // The mode watcher ran first, so add mode stays on afterwards.
    expect(ui.coverageMaskActive).toBe(true);
    expect(ui.coverageMaskIsRemove).toBe(false);
  });

  it("stays in a resting mode", () => {
    const { driver } = makeDriver(REVIEW_MODE);

    doRemove(driver);

    expect(driver.setMode).not.toHaveBeenCalled();
    expect(driver.mode).toBe(REVIEW_MODE);
    expect(ui.coverageMaskActive).toBe(true);
    expect(ui.coverageMaskIsRemove).toBe(true);
  });

  it("shows a hidden Done Area", () => {
    const { driver } = makeDriver(DEFAULT_MODE);
    ui.coverageMaskVisible = false;

    doAdd(driver);

    expect(ui.coverageMaskVisible).toBe(true);
  });

  it("runs from the K and Shift+K commands", () => {
    const { driver, run } = makeDriver(IMAGE_BOUNDING_BOX);
    registerAdd(driver as unknown as IIdahDriverV2);
    registerRemove(driver as unknown as IIdahDriverV2);

    run("coverage-mask-add");
    expect(driver.mode).toBe(DEFAULT_MODE);
    expect(ui.coverageMaskActive && !ui.coverageMaskIsRemove).toBe(true);

    run("coverage-mask-remove");
    expect(ui.coverageMaskActive && ui.coverageMaskIsRemove).toBe(true);
  });
});

describe("hide / show", () => {
  it("hiding leaves add/remove", () => {
    ui.coverageMaskActive = true;

    hideMask();

    expect(ui.coverageMaskVisible).toBe(false);
    expect(ui.coverageMaskActive).toBe(false);
  });

  it("H toggles visibility and keeps a drawing tool on", () => {
    const { driver, run } = makeDriver(IMAGE_BOUNDING_BOX);
    registerToggleVisibility(driver as unknown as IIdahDriverV2);

    run("coverage-mask-toggle-visibility");
    expect(ui.coverageMaskVisible).toBe(false);

    run("coverage-mask-toggle-visibility");
    expect(ui.coverageMaskVisible).toBe(true);
    expect(driver.mode).toBe(IMAGE_BOUNDING_BOX);
  });
});

describe("leaving add/remove", () => {
  it("Escape exit is only active during add/remove, and turns it off", () => {
    const { driver, commands, run } = makeDriver(DEFAULT_MODE);
    registerExit(driver as unknown as IIdahDriverV2);
    const exit = commands.get("coverage-mask-exit")!;

    expect(exit.activeWhen?.()).toBe(false);

    ui.coverageMaskActive = true;
    expect(exit.activeWhen?.()).toBe(true);

    run("coverage-mask-exit");
    expect(ui.coverageMaskActive).toBe(false);
    expect(driver.toolbar.invalidate).toHaveBeenCalled();
  });

  it("Selection leaves add/remove while already in the resting mode", () => {
    const { driver, run } = makeDriver(DEFAULT_MODE);
    registerSelect(driver as unknown as IIdahDriverV2);
    ui.coverageMaskActive = true;

    run("idah-image:tool.selection");

    expect(driver.mode).toBe(DEFAULT_MODE);
    expect(ui.coverageMaskActive).toBe(false);
    expect(driver.toolbar.invalidate).toHaveBeenCalled();
  });
});
