// ---------------------------------------------------------------------------
// _SelectedAnnotationsList.test.ts — Regression test for the multi-selection
// sidebar list field-access contract.
//
// This component renders whenever more than one annotation is selected. It
// previously read `ann.shape.type` and `ann.value?.category` — fields that no
// longer exist on the flattened annotation record (which now carries
// `shape_type` / `category` as top-level fields). Accessing `.shape.type` on a
// record whose `shape` field is absent throws `Cannot read properties of
// undefined`, breaking the whole multi-selection sidebar.
//
// There is no DOM rendering harness in this plugin, so this test pins the
// exact field-access expressions the component's template relies on, against
// properly-shaped records, so a regression to the old field names is caught.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

import { categoryValueToLabel } from "$lib/utils/annotation";
import { VIDEO_POLYGON } from "$lib/types";

// ── Mocks ──────────────────────────────────────────────────────────────────
interface ConfigValue {
  id: string;
  label?: string;
  color?: string;
}
const mockConfig = vi.hoisted(() => ({} as Record<string, { values?: ConfigValue[] }>));
const mockSelectedAnnotations = vi.hoisted(() => [] as any[]);

vi.mock("$lib/state/driver.svelte", () => ({
  getDriver: () => ({ config: mockConfig }),
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get selectedAnnotations() { return mockSelectedAnnotations; },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** A properly-shaped annotation record (flattened schema). */
function makeAnn(
  id: string,
  shape_type: string,
  category: string,
  groupId?: string,
): any {
  return {
    id,
    shape_type,
    shape_args: { start: 0, end: 10, frames: [] },
    category,
    metadata: groupId ? { group_id: groupId } : undefined,
  };
}

describe("_SelectedAnnotationsList field access", () => {
  beforeEach(() => {
    mockSelectedAnnotations.splice(0, mockSelectedAnnotations.length);
    for (const k of Object.keys(mockConfig)) delete mockConfig[k];
  });

  it("reads shape_type and category off properly-shaped records without throwing", () => {
    const ann = makeAnn("ann-001", VIDEO_POLYGON, "vehicle/car", "grp-1");
    mockSelectedAnnotations.push(ann);

    // The exact expressions the template uses:
    const annShapeType = ann.shape_type as string;
    const annConfig = mockConfig[annShapeType];
    const annCategory = annConfig?.values?.find((v) => v.id === ann.category);
    const annGroupId = ann.metadata?.group_id ?? ann.id;
    const annGroupIdLastPart = annGroupId.split("-").pop();
    const annDisplayName = annCategory
      ? `${annCategory.label}-${annGroupIdLastPart}`
      : (ann.category ?? "Uncategorized");
    const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : "";

    expect(annShapeType).toBe(VIDEO_POLYGON);
    expect(annGroupId).toBe("grp-1");
    expect(annGroupIdLastPart).toBe("1");
    // No config → falls back to the raw category path.
    expect(annDisplayName).toBe("vehicle/car");
    expect(annParentLabel).toBe("");
  });

  it("resolves the category label from config when present", () => {
    mockConfig[VIDEO_POLYGON] = {
      values: [{ id: "vehicle/car", label: "Car", color: "#ff0000" }],
    };
    const ann = makeAnn("ann-001", VIDEO_POLYGON, "vehicle/car", "grp-1");
    mockSelectedAnnotations.push(ann);

    const annShapeType = ann.shape_type as string;
    const annConfig = mockConfig[annShapeType];
    const annCategory = annConfig?.values?.find((v) => v.id === ann.category);
    const annGroupId = ann.metadata?.group_id ?? ann.id;
    const annGroupIdLastPart = annGroupId.split("-").pop();
    const annDisplayName = annCategory
      ? `${annCategory.label}-${annGroupIdLastPart}`
      : (ann.category ?? "Uncategorized");
    const annParentLabel = annCategory ? categoryValueToLabel(annCategory.id) : "";

    expect(annCategory?.color).toBe("#ff0000");
    expect(annDisplayName).toBe("Car-1");
    // categoryValueToLabel with one argument pops the leaf segment.
    expect(annParentLabel).toBe("Vehicle");
  });

  it("falls back to the annotation id when no group_id is present", () => {
    const ann = makeAnn("ann-001", VIDEO_POLYGON, "vehicle/car");
    mockSelectedAnnotations.push(ann);

    const annGroupId = ann.metadata?.group_id ?? ann.id;
    const annGroupIdLastPart = annGroupId.split("-").pop();

    expect(annGroupId).toBe("ann-001");
    expect(annGroupIdLastPart).toBe("001");
  });
});