// ---------------------------------------------------------------------------
// annotationsBackendCrud.test.ts — setShape/setShapes transport + fetch paging
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonRpcDatasource } from "@/data/jsonrpc";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/data/model/dataset/annotations/record", () => ({ annotationsBackendDataSource: { list } }));

import { createBackendCrudDriver, AnnotationsDriverAdapter } from "./annotationsBackendCrud";

function makeRpc() {
  const call = vi.fn().mockResolvedValue({});
  return { call } as unknown as JsonRpcDatasource;
}

/** The write_shapes call params passed to rpc.call — typed for assertions. */
function writeShapesCall(
  rpc: JsonRpcDatasource,
  index: number,
): { method: string; params: { annotation_id: string; entries: Array<{ key: string; value: unknown }> } } {
  return vi.mocked(rpc.call).mock.calls[index][0] as ReturnType<typeof writeShapesCall>;
}

describe("createBackendCrudDriver", () => {
  const entryId = "entry-1";
  const rpc = makeRpc();
  const driver = createBackendCrudDriver(entryId, rpc);

  beforeEach(() => {
    vi.mocked(rpc.call).mockClear();
  });

  it("setShapes with three entries makes one write_shapes call with all three", async () => {
    await driver.setShapes("ann-1", [
      { key: "tile-0x0", value: { rle: "A" } },
      { key: "tile-0x1", value: { rle: "B" } },
      { key: "tile-0x2", value: null },
    ]);

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith({
      method: "write_shapes",
      params: {
        annotation_id: "ann-1",
        entries: [
          { key: "tile-0x0", value: { rle: "A" } },
          { key: "tile-0x1", value: { rle: "B" } },
          { key: "tile-0x2", value: null },
        ],
      },
    });
  });

  it("setShapes with 1,001 entries makes two write_shapes calls", async () => {
    const entries = Array.from({ length: 1001 }, (_, i) => ({ key: `tile-${i}`, value: { rle: `A${i}` } }));

    await driver.setShapes("ann-1", entries);

    expect(rpc.call).toHaveBeenCalledTimes(2);
    const first = writeShapesCall(rpc, 0);
    const second = writeShapesCall(rpc, 1);
    expect(first.method).toBe("write_shapes");
    expect(first.params.entries).toHaveLength(1000);
    expect(second.method).toBe("write_shapes");
    expect(second.params.entries).toHaveLength(1);
    expect(second.params.entries[0].key).toBe("tile-1000");
  });

  it("setShape still makes one write_shape call", async () => {
    await driver.setShape("ann-1", "tile-0x0", { rle: "A" });

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith({
      method: "write_shape",
      params: { annotation_id: "ann-1", key: "tile-0x0", value: { rle: "A" } },
    });
  });
});

describe("AnnotationsDriverAdapter", () => {
  const entryId = "entry-1";
  const rpc = makeRpc();
  const driver = new AnnotationsDriverAdapter(entryId, rpc);

  beforeEach(() => {
    vi.mocked(rpc.call).mockClear();
    list.mockReset();
    list.mockResolvedValue({ data: [] });
  });

  it("setShapes with three entries makes one write_shapes call with all three", async () => {
    await driver.setShapes("ann-1", [
      { key: "tile-0x0", value: { rle: "A" } },
      { key: "tile-0x1", value: { rle: "B" } },
      { key: "tile-0x2", value: null },
    ]);

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith({
      method: "write_shapes",
      params: {
        annotation_id: "ann-1",
        entries: [
          { key: "tile-0x0", value: { rle: "A" } },
          { key: "tile-0x1", value: { rle: "B" } },
          { key: "tile-0x2", value: null },
        ],
      },
    });
  });

  it("setShapes with 1,001 entries makes two write_shapes calls", async () => {
    const entries = Array.from({ length: 1001 }, (_, i) => ({ key: `tile-${i}`, value: { rle: `A${i}` } }));

    await driver.setShapes("ann-1", entries);

    expect(rpc.call).toHaveBeenCalledTimes(2);
    const first = writeShapesCall(rpc, 0);
    const second = writeShapesCall(rpc, 1);
    expect(first.params.entries).toHaveLength(1000);
    expect(second.params.entries).toHaveLength(1);
  });

  it("setShape still makes one write_shape call", async () => {
    await driver.setShape("ann-1", "tile-0x0", { rle: "A" });

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith({
      method: "write_shape",
      params: { annotation_id: "ann-1", key: "tile-0x0", value: { rle: "A" } },
    });
  });

  it('fetch sends deleted: "false" by default', async () => {
    await driver.fetch();

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ deleted: "false" }) }),
    );
  });

  it('fetch sends deleted: "true" for deleted: "true"', async () => {
    await driver.fetch({ deleted: "true" });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ deleted: "true" }) }),
    );
  });

  it('fetch sends no deleted filter for deleted: "all"', async () => {
    await driver.fetch({ deleted: "all" });

    const call = list.mock.calls[0][0] as { filters: Record<string, unknown> };
    expect(call.filters).not.toHaveProperty("deleted");
  });

  it("exposes the change-history methods", async () => {
    expect(typeof driver.changes).toBe("function");
    expect(typeof driver.version).toBe("function");
  });

  it("fetches every page for the current entry", async () => {
    const record = (id: string) => ({
      id,
      shape_type: "idah-video:bounding-box",
      shape_args: { start: 0, end: 1 },
      category: "vehicle",
      properties: {},
      metadata: { group_id: "track-7" },
    });
    list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => record(`ann-${index}`)) });
    list.mockResolvedValueOnce({ data: [record("off-frame")] });

    const annotations = await driver.fetch();

    expect(annotations).toHaveLength(101);
    expect(annotations.at(-1)?.id).toBe("off-frame");
    expect(list).toHaveBeenNthCalledWith(1, {
      filters: { entry_id: "entry-1", deleted: "false" },
      pagination: { page: 1, itemsPerPage: 100 },
      sort: ["id"],
      noCache: true,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      filters: { entry_id: "entry-1", deleted: "false" },
      pagination: { page: 2, itemsPerPage: 100 },
      sort: ["id"],
      noCache: true,
    });
  });
});
