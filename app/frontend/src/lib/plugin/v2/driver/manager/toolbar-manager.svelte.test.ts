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

  it("keeps registration order: a group sits where its first item was registered", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.selection", null));
    mgr.add(opts("mode.mask_brush", "mask"));
    mgr.add(opts("mode.note", null));
    mgr.add(opts("mode.mask_polygon", "mask"));

    const nodes = mgr.getNodesForMode(MODE);

    // The mask group takes the slot of its first member (mask_brush); the later mask item
    // folds into it rather than moving it.
    expect(nodes.map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual([
      "mode.selection",
      "mask",
      "mode.note",
    ]);
    expect(asGroup(nodes[1]).children).toHaveLength(2);
  });

  it("orderGroups reorders the listed top-level groups within the slots groups occupy", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("a1", "a"));
    mgr.add(opts("mode.selection", null));
    mgr.add(opts("b1", "b"));
    mgr.orderGroups(MODE, ["b", "a"]);

    const nodes = mgr.getNodesForMode(MODE);

    expect(nodes.map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual(["b", "mode.selection", "a"]);
  });

  it("ignores orderGroups names that are not groups", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.selection", null));
    mgr.add(opts("mask1", "mask"));
    mgr.orderGroups(MODE, ["selection"]);

    expect(mgr.getNodesForMode(MODE).map((n) => (n.kind === "item" ? n.item.name : n.path))).toEqual([
      "mode.selection",
      "mask",
    ]);
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

describe("ToolbarManagerV2.defineGroup", () => {
  it("attaches the group's label and icon to its node", () => {
    const mgr = new ToolbarManagerV2();
    mgr.defineGroup("done-area", { label: "Done Area", icon: "<svg>done</svg>" });
    mgr.add(opts("coverage-mask-add", "done-area"));

    const group = asGroup(mgr.getNodesForMode(MODE)[0]);

    expect(group.label).toBe("Done Area");
    expect(group.icon).toBe("<svg>done</svg>");
  });

  it("matches metadata to nested paths by their full colon path", () => {
    const mgr = new ToolbarManagerV2();
    mgr.defineGroup("line:trend", { label: "Trend" });
    mgr.add(opts("mode.trend_line", "line:trend"));

    const line = asGroup(mgr.getNodesForMode(MODE)[0]);
    const trend = asGroup(line.children[0]);

    expect(line.label).toBeUndefined();
    expect(trend.label).toBe("Trend");
    expect(trend.icon).toBeUndefined();
  });

  it("leaves groups without metadata unlabelled", () => {
    const mgr = new ToolbarManagerV2();
    mgr.add(opts("mode.mask_brush", "mask"));

    const group = asGroup(mgr.getNodesForMode(MODE)[0]);

    expect(group.label).toBeUndefined();
    expect(group.icon).toBeUndefined();
  });

  it("carries the group's accent predicate and variant to its node", () => {
    const mgr = new ToolbarManagerV2();
    const whenAccented = () => true;
    mgr.defineGroup("done-area", { label: "Done Area", whenAccented, accentVariant: "success" });
    mgr.add(opts("coverage-mask-add", "done-area"));

    const group = asGroup(mgr.getNodesForMode(MODE)[0]);

    expect(group.whenAccented).toBe(whenAccented);
    expect(group.accentVariant).toBe("success");
  });

  it("takes the section from defineGroup, else from its first item", () => {
    const mgr = new ToolbarManagerV2();
    mgr.defineGroup("done-area", { label: "Done Area", section: "check" });
    mgr.add(opts("coverage-mask-add", "done-area", { section: "draw" }));
    mgr.add(opts("mode.mask_brush", "mask", { section: "draw" }));

    const [doneArea, mask] = mgr.getNodesForMode(MODE).map(asGroup);

    expect(doneArea.section).toBe("check");
    expect(mask.section).toBe("draw");
  });

  it("does not create a group node for metadata without items", () => {
    const mgr = new ToolbarManagerV2();
    mgr.defineGroup("done-area", { label: "Done Area" });

    expect(mgr.getNodesForMode(MODE)).toEqual([]);
  });

  it("forgets group metadata on clear()", () => {
    const mgr = new ToolbarManagerV2();
    mgr.defineGroup("done-area", { label: "Done Area" });
    mgr.clear();
    mgr.add(opts("coverage-mask-add", "done-area"));

    expect(asGroup(mgr.getNodesForMode(MODE)[0]).label).toBeUndefined();
  });
});

describe("ToolbarManagerV2.add", () => {
  it("keeps dynamic icons and labels as functions, plus separator and variant", () => {
    const mgr = new ToolbarManagerV2();
    const icon = () => "<svg>eye</svg>";
    const label = () => "Hide";
    mgr.add(opts("toggle", "done-area", { icon, label }));
    mgr.add(opts("clear", "done-area", { separatorBefore: true, variant: "destructive", section: "check" }));

    const [toggle, clear] = asGroup(mgr.getNodesForMode(MODE)[0]).children;
    if (toggle.kind !== "item" || clear.kind !== "item") throw new Error("expected items");

    expect(toggle.item.icon).toBe(icon);
    expect(toggle.item.label).toBe(label);
    expect(clear.item.separatorBefore).toBe(true);
    expect(clear.item.variant).toBe("destructive");
    expect(clear.item.section).toBe("check");
  });
});
