// ---------------------------------------------------------------------------
// reuse_last.test.ts — category.reuse-last against mocked data/selection/editor/
// toast stores and a real category picker with a spy handler attached.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { register, command } from "./reuse_last";
import { categoryPicker } from "$lib/state/category-picker";

const mockDataItems = vi.hoisted(() => [] as any[]);
const mockSelectionValue = vi.hoisted(() => ({ value: null as any }));
const mockDeselect = vi.hoisted(() => vi.fn());
const mockIsEditable = vi.hoisted(() => vi.fn(() => true));
const mockToastInfo = vi.hoisted(() => vi.fn());
const mockToastWarning = vi.hoisted(() => vi.fn());

vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      get items() {
        return mockDataItems;
      },
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get value() {
      return mockSelectionValue.value;
    },
    deselect: mockDeselect,
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => mockIsEditable(),
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: { info: mockToastInfo, warning: mockToastWarning },
}));

const box = "idah-video:bounding-box";
const ann = (id: string, category: string, shape_type = box) => ({ id, shape_type, category });

function setup() {
  let callback: () => any = () => undefined;
  const driver: any = { command: { register: (opts: any) => (callback = opts.callback) } };
  register(driver);
  const apply = vi.fn((_category: string, _shapeType: string) => true);
  const detach = categoryPicker.attach(apply);
  return { run: () => callback(), apply, detach };
}

describe("idah-video:category.reuse-last", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    mockDataItems.length = 0;
    mockSelectionValue.value = null;
    mockIsEditable.mockReturnValue(true);
    vi.clearAllMocks();
    ctx = setup();
  });
  afterEach(() => ctx.detach());

  it("ships on R in the Annotation group, so it is listed and editable with the other shortcuts", () => {
    expect(command.shortcut).toBe("R");
    expect(command.group).toBe("Annotation");
  });

  it("shows a hint and picks nothing when no annotation exists", () => {
    ctx.run();
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledOnce();
  });

  it("ignores tagging annotations", () => {
    mockDataItems.push(ann("0190a000-0000-7000-8000-000000000001", "scene/night", "entry:root"));
    ctx.run();
    expect(ctx.apply).not.toHaveBeenCalled();
  });

  it("picks the newest category for the next annotation", () => {
    mockDataItems.push(
      ann("0190a000-0000-7000-8000-000000000002", "vehicle/car"),
      ann("0190a000-0000-7000-8000-000000000001", "person/adult"),
    );
    ctx.run();
    expect(mockDeselect).toHaveBeenCalledOnce();
    expect(ctx.apply).toHaveBeenCalledWith("vehicle/car", box);
  });

  it("clears a selection with another category instead of changing it", () => {
    const other = ann("0190a000-0000-7000-8000-000000000001", "person/adult");
    mockDataItems.push(other, ann("0190a000-0000-7000-8000-000000000002", "vehicle/car"));
    mockSelectionValue.value = { type: "annotation", annotation: other };
    ctx.run();
    expect(mockDeselect).toHaveBeenCalledOnce();
    expect(mockDeselect.mock.invocationCallOrder[0]).toBeLessThan(ctx.apply.mock.invocationCallOrder[0]);
    expect(ctx.apply).toHaveBeenCalledWith("vehicle/car", box);
    expect(other.category).toBe("person/adult");
  });

  it("warns when the category is no longer in the label configuration", () => {
    mockDataItems.push(ann("0190a000-0000-7000-8000-000000000001", "vehicle/car"));
    ctx.apply.mockReturnValue(false);
    ctx.run();
    expect(mockToastWarning).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("vehicle/car") }),
    );
  });

  it("does nothing when the workflow step is read-only", () => {
    mockIsEditable.mockReturnValue(false);
    mockDataItems.push(ann("0190a000-0000-7000-8000-000000000001", "vehicle/car"));
    ctx.run();
    expect(mockDeselect).not.toHaveBeenCalled();
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });
});
