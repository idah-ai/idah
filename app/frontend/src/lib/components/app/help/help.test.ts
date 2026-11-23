// ---------------------------------------------------------------------------
// help.test.ts — the help drawer closes once its topic's links leave the page
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import { closeHelp, help, openHelp, registerHelpLink } from "./help.svelte";

describe("registerHelpLink", () => {
  afterEach(() => {
    closeHelp();
    vi.useRealTimers();
  });

  it("closes the drawer when the last link for its topic is removed", () => {
    vi.useFakeTimers();
    const first = registerHelpLink("upload");
    const second = registerHelpLink("upload");
    openHelp("upload");

    first();
    vi.runAllTimers();
    expect(help.topic).toBe("upload"); // another link is still there

    second();
    vi.runAllTimers();
    expect(help.topic).toBeNull();
  });

  it("stays open when a link is only re-rendered (removed, then added back)", () => {
    vi.useFakeTimers();
    const unregister = registerHelpLink("upload");
    openHelp("upload");

    unregister();
    registerHelpLink("upload");
    vi.runAllTimers();

    expect(help.topic).toBe("upload");
  });

  it("leaves another topic alone, and topics opened without a link", () => {
    vi.useFakeTimers();
    const unregister = registerHelpLink("upload");
    openHelp("other"); // e.g. from a "#help:other" link inside a topic

    unregister();
    vi.runAllTimers();

    expect(help.topic).toBe("other");
  });
});
