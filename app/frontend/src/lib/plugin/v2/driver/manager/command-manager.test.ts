import { beforeEach, describe, expect, it } from "vitest";

import { CommandManagerV2 } from "./command-manager";
import type { ICommandAction, IShortcut } from "../../types";

// Records which command fired, so we can assert dispatch precedence.
let fired: string[];

function keyEvent(letter: string): KeyboardEvent {
  return {
    key: letter.toLowerCase(),
    code: `Key${letter.toUpperCase()}`,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  } as unknown as KeyboardEvent;
}

function registerCmd(
  mgr: CommandManagerV2,
  name: string,
  shortcut: IShortcut | null,
  opts: { activeWhen?: () => boolean } = {},
): void {
  mgr.register({
    name,
    modes: ["default"],
    shortcut,
    shortDescription: name,
    longDescription: null,
    activeWhen: opts.activeWhen,
    callback: () => ({ do: () => fired.push(name) }) as unknown as ICommandAction,
  });
}

describe("CommandManagerV2.resolveKeyEvent — override-aware precedence", () => {
  beforeEach(() => {
    fired = [];
  });

  it("applies a user override: the overridden key fires the command", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "box", "B");
    mgr.attachOverrides({ box: "K" });

    expect(mgr.resolveKeyEvent(keyEvent("K"), "default")).toBe(true);
    expect(fired).toEqual(["box"]);
  });

  it("stops matching the shipped default once a command is overridden", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "box", "B");
    mgr.attachOverrides({ box: "K" });

    expect(mgr.resolveKeyEvent(keyEvent("B"), "default")).toBe(false);
    expect(fired).toEqual([]);
  });

  it("user override beats another command's shipped default on the same key", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "redo", "K"); // owns K by default
    registerCmd(mgr, "box", "B");
    mgr.attachOverrides({ box: "K" }); // box remapped onto K

    expect(mgr.resolveKeyEvent(keyEvent("K"), "default")).toBe(true);
    expect(fired).toEqual(["box"]);
  });

  it("an active context-gated command beats a plain one sharing the key", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "plain", "B");
    registerCmd(mgr, "gated", "B", { activeWhen: () => true });

    expect(mgr.resolveKeyEvent(keyEvent("B"), "default")).toBe(true);
    expect(fired).toEqual(["gated"]);
  });

  it("skips a context-gated command whose activeWhen is false", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "gated", "B", { activeWhen: () => false });
    registerCmd(mgr, "plain", "B");

    expect(mgr.resolveKeyEvent(keyEvent("B"), "default")).toBe(true);
    expect(fired).toEqual(["plain"]);
  });

  it("falls back to registration order for plain ties", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "first", "B");
    registerCmd(mgr, "second", "B");

    expect(mgr.resolveKeyEvent(keyEvent("B"), "default")).toBe(true);
    expect(fired).toEqual(["first"]);
  });
});

describe("CommandManagerV2.getKeyMapForMode — effective shortcuts", () => {
  it("reflects overrides instead of shipped defaults", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "box", "B");
    mgr.attachOverrides({ box: "K" });

    const map = mgr.getKeyMapForMode("default");
    expect(map["K"]).toBe("box");
    expect(map["B"]).toBeUndefined();
  });
});

describe("CommandManagerV2 — short-name resolution", () => {
  // Resolution is exercised through getCommand(), which is routed through the
  // same private resolve() as call() but returns synchronously (call() defers
  // dispatch onto a promise chain).

  it("resolves a fully-qualified name via exact match", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "core:history.undo", null);

    expect(mgr.getCommand("core:history.undo")?.name).toBe("core:history.undo");
  });

  it("expands a short core name when only core defines it", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "core:history.undo", null);

    expect(mgr.getCommand("history.undo")?.name).toBe("core:history.undo");
  });

  it("expands a short plugin name when only the plugin defines it", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "core:history.undo", null);
    registerCmd(mgr, "idah-video:annotation.add", null); // sets pluginOrigin

    expect(mgr.getCommand("annotation.add")?.name).toBe("idah-video:annotation.add");
  });

  it("fails closed when a short name is ambiguous across origins", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "core:tool.note", null);
    registerCmd(mgr, "idah-video:tool.note", null); // same short name under two origins

    expect(mgr.getCommand("tool.note")).toBeUndefined();
  });

  it("returns undefined for an unknown name", () => {
    const mgr = new CommandManagerV2();
    registerCmd(mgr, "core:history.undo", null);

    expect(mgr.getCommand("does.not.exist")).toBeUndefined();
  });
});
