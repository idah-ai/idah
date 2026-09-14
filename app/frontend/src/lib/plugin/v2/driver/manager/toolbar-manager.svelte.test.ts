import { describe, expect, it } from "vitest";

import { ToolbarManagerV2 } from "./toolbar-manager.svelte";
import type { IToolbarGroupNode, IToolbarNode, ToolbarItemOptions } from "../../types";

const MODE = "idah-image:mask";

function opts(name: string, group: string | null, extra: Partial<ToolbarItemOptions> = {}): ToolbarItemOptions {
  return {
    name,
    icon: `<svg>${name}</svg>`,
    label: name,
    modes: [MODE],
    group,
    onClick: () => {},
    ...extra,
  };
}

/** Narrow a node to a group, failing the test otherwise. */
function asGroup(node: IToolbarNode): IToolbarGroupNode {
  if (node.kind !== "group") throw new Error(`expected group, got ${node.kind}`);
  return node;
}

describe("ToolbarManagerV2.getNodesForMode", () => {
  it("keeps null-group items as flat leaves in registration order", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.selection", null));
    mgr.add(opts("mode.bounding_box", null));

    const nodes = mgr.getNodesForMode(MODE);

    expect(nodes.map((n) => n.kind)).toEqual(["item", "item"]);
    expect(nodes.map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual([
      "mode.selection",
      "mode.bounding_box",
    ]);
  });

  it("collapses items sharing a path into one group node", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.mask_brush", "mask"));
    mgr.add(opts("mode.mask_polygon", "mask"));

    const nodes = mgr.getNodesForMode(MODE);

    expect(nodes).toHaveLength(1);
    const group = asGroup(nodes[0]);
    expect(group.path).toBe("mask");
    expect(group.segment).toBe("mask");
    expect(group.children.map((c) => (c.kind === "item" ? c.item.name : c.path))).toEqual([
      "mode.mask_brush",
      "mode.mask_polygon",
    ]);
  });

  it("nests deeper colon paths into subgroups", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.trend_line", "line:trend"));
    mgr.add(opts("mode.trend_angle", "line:trend"));
    mgr.add(opts("mode.ray", "line:ray"));

    const nodes = mgr.getNodesForMode(MODE);

    expect(nodes).toHaveLength(1);
    const line = asGroup(nodes[0]);
    expect(line.path).toBe("line");
    expect(line.children.map((c) => c.kind)).toEqual(["group", "group"]);

    const trend = asGroup(line.children[0]);
    const ray = asGroup(line.children[1]);
    expect(trend.path).toBe("line:trend");
    expect(trend.segment).toBe("trend");
    expect(trend.children).toHaveLength(2);
    expect(ray.path).toBe("line:ray");
    expect(ray.children).toHaveLength(1);
  });

  it("renders standalone items first, then groups (getItemsForMode null-first ordering)", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.selection", null));
    mgr.add(opts("mode.mask_brush", "mask"));
    mgr.add(opts("mode.note", null));
    mgr.add(opts("mode.mask_polygon", "mask"));

    const nodes = mgr.getNodesForMode(MODE);

    // Null-group leaves come first in registration order, then the mask group; the two
    // mask items fold into that single group node.
    expect(nodes.map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual([
      "mode.selection",
      "mode.note",
      "mask",
    ]);
    expect(asGroup(nodes[2]).children).toHaveLength(2);
  });

  it("excludes children hidden by visibleWhen and drops emptied groups", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.mask_brush", "mask", { visibleWhen: () => false }));
    mgr.add(opts("mode.mask_polygon", "mask", { visibleWhen: () => false }));
    mgr.add(opts("mode.selection", null));

    const nodes = mgr.getNodesForMode(MODE);

    // Both mask children filtered out by getItemsForMode → no group node at all.
    expect(nodes.map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual(["mode.selection"]);
  });
});
