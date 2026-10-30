import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonRpcDatasource } from "@/data/jsonrpc";

const list = vi.hoisted(() => vi.fn());
vi.mock("@/data/model/dataset/annotations/record", () => ({ annotationsBackendDataSource: { list } }));

import { AnnotationsDriverAdapter } from "./annotationsBackendCrud";

const record = (id: string) => ({
  id,
  shape_type: "idah-video:bounding-box",
  shape_args: { start: 0, end: 1 },
  category: "vehicle",
  properties: {},
  metadata: { group_id: "track-7" },
});

describe("AnnotationsDriverAdapter.fetch", () => {
  beforeEach(() => list.mockReset());

  it("fetches every page for the current entry", async () => {
    list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => record(`ann-${index}`)) });
    list.mockResolvedValueOnce({ data: [record("off-frame")] });
    const driver = new AnnotationsDriverAdapter("entry-1", {} as JsonRpcDatasource);

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
