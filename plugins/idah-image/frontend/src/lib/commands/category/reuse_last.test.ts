// ---------------------------------------------------------------------------
// reuse_last.test.ts — category.reuse-last against mocked selection/editor/toast
// stores, the real recent-category store (in memory: tests have no
// localStorage), and a category picker with a spy handler attached.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { register, command } from "./reuse_last";
import { categoryPicker } from "$lib/state/category-picker";
import { recentCategory } from "$lib/state/recent-category";

const mockDeselect = vi.hoisted(() => vi.fn());
const mockIsEditable = vi.hoisted(() => vi.fn(() => true));
const mockToastInfo = vi.hoisted(() => vi.fn());
const mockToastWarning = vi.hoisted(() => vi.fn());

vi.mock("$lib/state/selection.svelte", () => ({
  selection: { deselect: mockDeselect },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => mockIsEditable(),
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: { info: mockToastInfo, warning: mockToastWarning },
}));

const box = "idah-image:bounding-box";

function setup(datasetId = "ds-1") {
  let callback: () => any = () => undefined;
  const driver: any = {
    dataset: { id: datasetId },
    command: { register: (opts: any) => (callback = opts.callback) },
  };
  register(driver);
  const apply = vi.fn((_category: string, _shapeType: string) => true);
  const detach = categoryPicker.attach(apply);
  return { run: () => callback(), apply, detach, driver };
}

describe("idah-image:category.reuse-last", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    mockIsEditable.mockReturnValue(true);
    recentCategory.reset();
    vi.clearAllMocks();
    ctx = setup();
  });
  afterEach(() => ctx.detach());

  it("ships on R in the Annotation group, so it is listed and editable with the other shortcuts", () => {
    expect(command.shortcut).toBe("R");
    expect(command.group).toBe("Annotation");
  });

  it("shows a hint and picks nothing before a category was used", () => {
    ctx.run();
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledOnce();
  });

  it("clears the selection and picks the category used last", () => {
    recentCategory.record(ctx.driver, "person/adult", box);
    recentCategory.record(ctx.driver, "vehicle/car", box);
    ctx.run();
    expect(mockDeselect).toHaveBeenCalledOnce();
    expect(mockDeselect.mock.invocationCallOrder[0]).toBeLessThan(ctx.apply.mock.invocationCallOrder[0]);
    expect(ctx.apply).toHaveBeenCalledWith("vehicle/car", box);
  });

  it("reuses a mask painted after the newest bbox (bbox, mask, bbox, mask)", () => {
    recentCategory.record(ctx.driver, "vehicle/car", box);
    recentCategory.record(ctx.driver, "road/lane", "idah-image:mask");
    recentCategory.record(ctx.driver, "vehicle/car", box);
    // The second stroke goes into the existing lane mask, which records its category (mask_shapes.flush).
    recentCategory.record(ctx.driver, "road/lane", "idah-image:mask");
    ctx.run();
    expect(ctx.apply).toHaveBeenCalledWith("road/lane", "idah-image:mask");
  });

  it("ignores a category used in another dataset", () => {
    const other = setup("ds-2");
    recentCategory.record(other.driver, "vehicle/car", box);
    other.detach();
    ctx = setup("ds-1");
    ctx.run();
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledOnce();
  });

  it("warns when the category is no longer in the label configuration", () => {
    recentCategory.record(ctx.driver, "vehicle/car", box);
    ctx.apply.mockReturnValue(false);
    ctx.run();
    expect(mockToastWarning).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("vehicle/car") }),
    );
  });

  it("does nothing when the workflow step is read-only", () => {
    mockIsEditable.mockReturnValue(false);
    recentCategory.record(ctx.driver, "vehicle/car", box);
    ctx.run();
    expect(mockDeselect).not.toHaveBeenCalled();
    expect(ctx.apply).not.toHaveBeenCalled();
  });
});
