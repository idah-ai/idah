// ---------------------------------------------------------------------------
// persistence.test.ts — Done Area draw / clear / undo against a store
//
// Runs the real draw and clear commands with the real coverage mask session
// against an in-memory annotation store that behaves like the backend:
// setShape(s) merges tile keys (null deletes one), delete is a soft delete
// that keeps the record's tiles, and restore merges those tiles back in.
// After each command, `sync()` reloads the session from the store, as the
// ShapesContainer effect does when the annotation changes.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

type Shape = Record<string, unknown>;
interface Ann {
  id: string;
  shape_type: string;
  category: string;
  shape_args: Shape;
  deleted_at?: string;
}

const { ui, editor, store } = vi.hoisted(() => {
  const records = new Map<string, Ann>();
  const calls: string[] = [];
  let seq = 0;
  const apply = (id: string, entries: Array<{ key: string; value: object | null }>) => {
    const rec = records.get(id)!;
    if (rec.deleted_at) throw new Error("write to a deleted annotation");
    for (const { key, value } of entries) {
      if (value === null) delete rec.shape_args[key];
      else rec.shape_args[key] = value;
    }
  };
  const annotations = {
    get items(): Ann[] {
      return [...records.values()].filter((r) => !r.deleted_at);
    },
    create: vi.fn(async (attrs: Omit<Ann, "id">) => {
      calls.push("create");
      const rec: Ann = { ...attrs, id: `ann-${++seq}`, shape_args: { ...attrs.shape_args } };
      records.set(rec.id, rec);
      return rec;
    }),
    setShape: vi.fn(async (id: string, key: string, value: object | null) => {
      calls.push("setShape");
      apply(id, [{ key, value }]);
    }),
    setShapes: vi.fn(async (id: string, entries: Array<{ key: string; value: object | null }>) => {
      calls.push("setShapes");
      apply(id, entries);
    }),
    delete: vi.fn(async (id: string) => {
      calls.push("delete");
      records.get(id)!.deleted_at = "now";
    }),
    // Like the backend: un-delete and merge the record's old shapes back in.
    restore: vi.fn(async (attrs: Ann) => {
      calls.push("restore");
      const rec = records.get(attrs.id)!;
      delete rec.deleted_at;
      rec.shape_args = { ...rec.shape_args, ...attrs.shape_args };
      return rec;
    }),
  };
  return {
    ui: { coverageMaskActive: false, coverageMaskIsRemove: false, coverageMaskVisible: true },
    editor: { editable: true },
    store: {
      records,
      calls,
      annotations,
      reset: () => {
        records.clear();
        calls.length = 0;
        seq = 0;
      },
    },
  };
});

vi.mock("$lib/state/ui.svelte", () => ({ ui }));
vi.mock("$lib/state/editor.svelte", () => ({ isEditable: () => editor.editable }));
vi.mock("$lib/state/data.svelte", () => ({ data: { annotations: store.annotations } }));
vi.mock("$lib/state/driver.svelte", () => ({ getDriver: () => ({ media: { resource: "res-1" } }) }));

import { session } from "$lib/mask/coverage-mask-session";
import { MASK_TILE_SIZE } from "$lib/mask/constants";
import { register as registerDraw } from "./draw";
import { register as registerClear } from "./clear";
import type { IIdahDriverV2 } from "$idah/v2/types";

interface Cmd {
  do(): unknown;
  undo?(): unknown;
}

function makeDriver() {
  const commands = new Map<string, { callback: (opts?: unknown) => Cmd }>();
  const driver = {
    settings: { invalidate: vi.fn() },
    toolbar: { invalidate: vi.fn() },
    command: { register: (opts: { name: string; callback: (opts?: unknown) => Cmd }) => commands.set(opts.name, opts) },
  };
  registerDraw(driver as unknown as IIdahDriverV2);
  registerClear(driver as unknown as IIdahDriverV2);
  return (name: string, opts?: unknown) => commands.get(name)!.callback(opts);
}

/** Reload the session from the stored done area, like ShapesContainer's effect. */
function sync() {
  const live = store.annotations.items.find((a) => a.category === "done_area");
  session.initFromRle(live?.shape_args ?? {});
}

function doneArea(): Ann | undefined {
  return [...store.records.values()].find((a) => a.category === "done_area");
}

function tileKeys(ann: Ann | undefined): string[] {
  return Object.keys(ann?.shape_args ?? {})
    .filter((k) => k.startsWith("tile-"))
    .sort();
}

/** Whether pixel (x, y) of the image is marked done in the session. */
function isDone(x: number, y: number): boolean {
  const col = Math.floor(x / MASK_TILE_SIZE);
  const row = Math.floor(y / MASK_TILE_SIZE);
  const buf = session.getTileBuffer(col, row);
  return !!buf && buf[(y - row * MASK_TILE_SIZE) * MASK_TILE_SIZE + (x - col * MASK_TILE_SIZE)] > 0;
}

/** Draw the way ShapesContainer does: snapshot the rect, then run the command. */
async function draw(
  command: ReturnType<typeof makeDriver>,
  rect: [number, number, number, number],
  mode: "add" | "remove",
) {
  const tileSnapshots = session.snapshotTiles(...rect);
  const cmd = command("coverage-mask-draw", { tileSnapshots, rect, mode });
  await cmd.do();
  sync();
  return cmd;
}

// Spans tiles 0x0 and 1x0
const RECT: [number, number, number, number] = [100, 10, 60, 20];

beforeEach(() => {
  vi.clearAllMocks();
  store.reset();
  session.reset();
  editor.editable = true;
});

describe("draw", () => {
  it("creates the done area on the first draw and saves the touched tiles", async () => {
    const command = makeDriver();

    await draw(command, RECT, "add");

    expect(store.annotations.create).toHaveBeenCalledOnce();
    expect(tileKeys(doneArea())).toEqual(["tile-0x0", "tile-1x0"]);
    expect(isDone(100, 10)).toBe(true);
    expect(isDone(159, 29)).toBe(true);
    // Outside the rect (the shared rasterizer also fills the right edge column, x = 160)
    expect(isDone(162, 20)).toBe(false);
    expect(isDone(120, 31)).toBe(false);
    expect(isDone(99, 20)).toBe(false);
  });

  it("removes only the erased part and drops tiles left empty", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");

    // Erase everything in tile 1x0 (x >= 128)
    await draw(command, [128, 0, 64, 64], "remove");

    expect(tileKeys(doneArea())).toEqual(["tile-0x0"]);
    expect(isDone(127, 10)).toBe(true);
    expect(isDone(128, 10)).toBe(false);
  });

  it("undo puts the tiles back as they were before the draw", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");
    const before = structuredClone(doneArea()!.shape_args);

    const erase = await draw(command, [0, 0, 128, 128], "remove");
    expect(tileKeys(doneArea())).toEqual(["tile-1x0"]);

    await erase.undo!();
    sync();

    expect(doneArea()!.shape_args).toEqual(before);
    expect(isDone(100, 10)).toBe(true);
  });

  it("does not paint or save when the entry is not editable", async () => {
    const command = makeDriver();
    editor.editable = false;

    await draw(command, RECT, "add");

    expect(store.calls).toEqual([]);
    expect(isDone(100, 10)).toBe(false);
  });
});

describe("clear", () => {
  it("deletes the tiles before soft-deleting the done area", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");
    store.calls.length = 0;

    await command("coverage-mask-clear").do();
    sync();

    expect(store.calls).toEqual(["setShapes", "delete"]);
    // A later restore cannot merge stale tiles back in
    expect(tileKeys(doneArea())).toEqual([]);
    expect(doneArea()!.deleted_at).toBeDefined();
    expect(isDone(100, 10)).toBe(false);
  });

  it("undo restores the same annotation with its tiles", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");
    const ann = doneArea()!;
    const before = structuredClone(ann.shape_args);

    const clear = command("coverage-mask-clear");
    await clear.do();
    sync();
    await clear.undo!();
    sync();

    expect(store.annotations.create).toHaveBeenCalledOnce();
    expect(doneArea()!.id).toBe(ann.id);
    expect(doneArea()!.deleted_at).toBeUndefined();
    expect(doneArea()!.shape_args).toEqual(before);
    expect(isDone(100, 10)).toBe(true);
  });

  it("a draw after clear + undo keeps the restored area", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");
    const clear = command("coverage-mask-clear");
    await clear.do();
    sync();
    await clear.undo!();
    sync();

    await draw(command, [300, 300, 10, 10], "add");

    expect(tileKeys(doneArea())).toEqual(["tile-0x0", "tile-1x0", "tile-2x2"]);
    expect(isDone(100, 10)).toBe(true);
    expect(isDone(305, 305)).toBe(true);
  });

  it("does nothing when the entry is not editable", async () => {
    const command = makeDriver();
    await draw(command, RECT, "add");
    store.calls.length = 0;
    editor.editable = false;

    await command("coverage-mask-clear").do();

    expect(store.calls).toEqual([]);
    expect(tileKeys(doneArea())).toEqual(["tile-0x0", "tile-1x0"]);
  });
});
