import { describe, it, expect, beforeEach } from "vitest";
import { session } from "./coverage-mask-session";
import { encode } from "./rle";

describe("coverage mask session versions", () => {
  beforeEach(() => session.reset());

  it("bumps the version only for tiles a rect touches", () => {
    session.initFromRle({});
    session.fillRect(0, 0, 10, 10, "add"); // tile 0:0 only
    const v00 = session.getTileVersion("0:0");
    const v10 = session.getTileVersion("1:0");
    session.fillRect(130, 0, 10, 10, "add"); // tile 1:0 only
    expect(session.getTileVersion("0:0")).toBe(v00);
    expect(session.getTileVersion("1:0")).toBeGreaterThan(v10);
  });

  it("skips unchanged tiles on reload and does not notify", () => {
    session.fillRect(0, 0, 10, 10, "add");
    const stored = {
      "tile-0x0": { rle: encode(session.getTileBuffer(0, 0)!, 128, 128) },
    };
    session.initFromRle(stored); // reload, version bumps
    const v = session.getTileVersion("0:0");

    let notified = 0;
    const off = session.onChange(() => notified++);
    session.initFromRle(stored); // unrelated reload, same data
    off();

    expect(session.getTileVersion("0:0")).toBe(v);
    expect(notified).toBe(0);
  });

  it("drops tiles that are no longer stored", () => {
    session.fillRect(0, 0, 10, 10, "add");
    session.initFromRle({});
    expect(session.getTileBuffer(0, 0)).toBeUndefined();
    expect([...session.tileKeys()]).toEqual([]);
  });
});
