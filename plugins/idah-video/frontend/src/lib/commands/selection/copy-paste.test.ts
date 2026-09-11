// ---------------------------------------------------------------------------
// copy-paste.test.ts — Integration tests for selection.copy / selection.paste
//
// Drives the real copy.ts / paste.ts modules against mocked data/selection/
// viewport/media stores.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clipboard } from "$lib/state/clipboard.svelte";
import { register as registerCopy } from "./copy";
import { register as registerPaste } from "./paste";
import { VIDEO_FRAME, ENTRY_ROOT } from "$lib/types";

// ── Hoisted mutable state for mocks ────────────────────────────────────────
const mockDataItems = vi.hoisted(() => [] as any[]);
const mockCreateFn = vi.hoisted(() => vi.fn<(...args: any[]) => any>());
const mockSelectedAnnotationIds = vi.hoisted(() => new Set<string>());
const mockSelectedGroupIds = vi.hoisted(() => new Set<string>());
const mockSelectAnnotations = vi.hoisted(() => vi.fn());
const mockAddAnnotations = vi.hoisted(() => vi.fn());
const mockSelectGroups = vi.hoisted(() => vi.fn());
const mockDeselect = vi.hoisted(() => vi.fn());
const mockCurrentFrameValue = vi.hoisted(() => ({ value: 0 }));
const mockCursor = vi.hoisted(() => [0.5, 0.5] as [number, number]);
const mockTotalFrames = vi.hoisted(() => 100);
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastWarning = vi.hoisted(() => vi.fn());
const mockUuidv7 = vi.hoisted(() => {
  let counter = 0;
  return vi.fn(() => `test-uuid-${counter++}`);
});
const mockRegister = vi.hoisted(() => vi.fn());

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      get items() { return mockDataItems; },
      create: mockCreateFn,
    },
  },
}));

vi.mock("$lib/state/selection.svelte", () => ({
  selection: {
    get selectedAnnotationIds() { return mockSelectedAnnotationIds; },
    get selectedGroupIds() { return mockSelectedGroupIds; },
    selectAnnotations: mockSelectAnnotations,
    addAnnotations: mockAddAnnotations,
    selectGroups: mockSelectGroups,
    deselect: mockDeselect,
    get selectedAnnotations() { return [] as any[]; },
  },
}));

vi.mock("$lib/state/viewport.svelte", () => ({
  viewport: {
    video: { currentFrame: mockCurrentFrameValue },
    cursor: mockCursor,
  },
}));

vi.mock("$lib/state/media.svelte", () => ({
  media: {
    get totalFrames() { return mockTotalFrames; },
  },
}));

vi.mock("$lib/state/editor.svelte", () => ({
  isEditable: () => true,
}));

vi.mock("$lib/components/ui/Toast/index.svelte", () => ({
  showToast: {
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

vi.mock("uuidv7", () => ({
  uuidv7: mockUuidv7,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal annotation fixture. */
function makeAnn(
  id: string,
  overrides: Record<string, unknown> = {},
): any {
  return {
    id,
    shape: {
      type: "idah-video:bounding-box",
      start: 10,
      end: 20,
      frames: [
        { frame: 10, angle: 0, points: [[0, 0], [100, 100]] },
        { frame: 15, angle: 0, points: [[10, 10], [90, 90]] },
        { frame: 20, angle: 0, points: [[20, 20], [80, 80]] },
      ],
    },
    value: { category: "test/cat" },
    ...overrides,
  };
}

/** Create a VIDEO_FRAME (per-frame tag) annotation fixture with the REAL native shape (frames: []). */
function makeFrameAnn(
  id: string,
  frame: number,
  category: string,
): any {
  return {
    id,
    shape: {
      type: VIDEO_FRAME,
      start: frame,
      end: frame,
      frames: [],
    },
    value: { category },
  };
}

/** Create a mock driver and register copy/paste commands. Returns { copyCallback, pasteCallback }. */
function registerCommands(): { copyCallback: (...args: any[]) => any; pasteCallback: (...args: any[]) => any } {
  const result: any = {};
  mockRegister.mockImplementation((opts: any) => {
    if (opts.name === "idah-video:selection.copy") {
      result.copyCallback = opts.callback;
    } else if (opts.name === "idah-video:selection.paste") {
      result.pasteCallback = opts.callback;
    }
  });
  const mockDriver = {
    command: { register: mockRegister },
    workflowStep: "annotate",
  };
  registerCopy(mockDriver as any);
  registerPaste(mockDriver as any);
  return result;
}

/** Reset all mutable mock state. */
function resetMocks(): void {
  mockDataItems.splice(0, mockDataItems.length);
  mockCreateFn.mockReset();
  mockCreateFn.mockResolvedValue({ id: "created" });
  mockSelectedAnnotationIds.clear();
  mockSelectedGroupIds.clear();
  mockSelectAnnotations.mockReset();
  mockAddAnnotations.mockReset();
  mockSelectGroups.mockReset();
  mockDeselect.mockReset();
  mockCurrentFrameValue.value = 0;
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockToastWarning.mockReset();
  mockUuidv7.mockReset();
  mockRegister.mockReset();
  clipboard.clear();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("selection.copy + selection.paste", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── Bug 1: Copying an idah-video:frame tag silently does nothing ────────

  describe("Bug 1 — VIDEO_FRAME copy", () => {
    it("copies a single idah-video:frame tag successfully", () => {
      const ann = makeFrameAnn("frame-001", 42, "test/tag");
      mockDataItems.push(ann);
      mockSelectedAnnotationIds.add("frame-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback } = registerCommands();
      const action = copyCallback();
      action.do();

      expect(clipboard.hasData).toBe(true);
      expect(clipboard.annotations).toHaveLength(1);
      expect(clipboard.annotations![0].shape.type).toBe(VIDEO_FRAME);
      expect(clipboard.copyFrame).toBe(42);
      // Centroid should be [0, 0] since VIDEO_FRAME has no points
      expect(clipboard.centroid).toEqual([0, 0]);
      // Success toast should have been shown
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copied" }),
      );
      // No error toast
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("copies a mix of VIDEO_FRAME and regular annotations", () => {
      const frameAnn = makeFrameAnn("frame-001", 42, "test/tag");
      const bboxAnn = makeAnn("bbox-001", {
        shape: {
          type: "idah-video:bounding-box",
          start: 40,
          end: 50,
          frames: [
            { frame: 40, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 45, angle: 0, points: [[10, 10], [90, 90]] },
            { frame: 50, angle: 0, points: [[20, 20], [80, 80]] },
          ],
        },
      });
      mockDataItems.push(frameAnn, bboxAnn);
      mockSelectedAnnotationIds.add("frame-001");
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback } = registerCommands();
      const action = copyCallback();
      action.do();

      expect(clipboard.hasData).toBe(true);
      expect(clipboard.annotations).toHaveLength(2);
      expect(clipboard.copyFrame).toBe(42);
      // Centroid should be non-zero (from the bbox points)
      expect(clipboard.centroid).not.toEqual([0, 0]);
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("copying and pasting an idah-video:frame tag with its REAL native shape (frames: []) succeeds", async () => {
      const tagShape = { type: VIDEO_FRAME, start: 12, end: 12, frames: [] };
      const tag = {
        id: "tag-1",
        shape: tagShape,
        value: { category: "weather/sunny" },
        metadata: {},
      };
      mockDataItems.push(tag);
      mockSelectedAnnotationIds.add("tag-1");
      mockCurrentFrameValue.value = 12;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      // Paste at frame 40 — well within bounds
      mockCurrentFrameValue.value = 40;

      const pasteAction = pasteCallback();
      await pasteAction.do();

      // The paste should have created exactly one annotation
      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      const created = mockCreateFn.mock.calls[0][0];
      expect(created.shape.start).toBe(40);
      expect(created.shape.end).toBe(40);
      expect(created.shape.frames).toEqual([]);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Pasted" }),
      );
    });
  });

  // ── Bug 2: Pasting a copied idah-video:frame tag can create a duplicate ──

  describe("Bug 2 — VIDEO_FRAME paste duplicate guard", () => {
    it("paste callback is not a noop when clipboard has data", async () => {
      const frameAnn = makeFrameAnn("frame-001", 42, "test/tag");
      mockDataItems.push(frameAnn);
      mockSelectedAnnotationIds.add("frame-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      const pasteAction = pasteCallback();
      expect(pasteAction.command.name).toBe("idah-video:selection.paste");
      expect(typeof (pasteAction as any).undo).toBe("function");

      await pasteAction.do();
      // The copied annotation is still in mockDataItems, so findFrameAnnotation
      // will find it as a conflict — the paste should be skipped
      expect(mockCreateFn).not.toHaveBeenCalled();
    });

    it("skips pasting a VIDEO_FRAME tag when same category already exists at target frame", async () => {
      const frameAnn = makeFrameAnn("frame-001", 42, "test/tag");
      mockDataItems.push(frameAnn);
      mockSelectedAnnotationIds.add("frame-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      // Paste at a DIFFERENT frame (delta != 0) so the target frame differs
      // from the source frame.
      mockCurrentFrameValue.value = 50;

      // Now add an existing tag at the target paste frame (frame 50, same category)
      const existingTag = makeFrameAnn("existing-tag", 50, "test/tag");
      mockDataItems.push(existingTag);

      const pasteAction = pasteCallback();
      await pasteAction.do();

      expect(mockCreateFn).not.toHaveBeenCalled();
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Paste skipped" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledTimes(1); // from copy step only
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("still pastes a VIDEO_FRAME tag when a different category exists at the target frame", async () => {
      const frameAnn = makeFrameAnn("frame-001", 42, "test/cat-a");
      mockDataItems.push(frameAnn);
      mockSelectedAnnotationIds.add("frame-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      mockCurrentFrameValue.value = 50;

      const existingTag = makeFrameAnn("existing-tag", 50, "test/cat-b");
      mockDataItems.push(existingTag);

      const pasteAction = pasteCallback();
      await pasteAction.do();

      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Pasted" }),
      );
    });

    it("pastes a VIDEO_FRAME tag onto a frame with no existing tag", async () => {
      const frameAnn = makeFrameAnn("frame-001", 42, "test/tag");
      mockDataItems.push(frameAnn);
      mockSelectedAnnotationIds.add("frame-001");
      mockCurrentFrameValue.value = 42;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      mockCurrentFrameValue.value = 50;

      const pasteAction = pasteCallback();
      await pasteAction.do();

      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Pasted" }),
      );
    });
  });

  // ── Bug 3: A failed copy leaves the previous clipboard content pasteable ─

  describe("Bug 3 — failed copy clears clipboard", () => {
    it("clears clipboard on ENTRY_ROOT rejection", () => {
      const bboxAnn = makeAnn("bbox-001");
      mockDataItems.push(bboxAnn);
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 15;

      const { copyCallback } = registerCommands();
      const action1 = copyCallback();
      action1.do();
      expect(clipboard.hasData).toBe(true);

      const rootAnn = {
        id: "root-001",
        shape: { type: ENTRY_ROOT },
        value: { category: "scene" },
      };
      mockDataItems.push(rootAnn);
      mockSelectedAnnotationIds.add("root-001");

      const action2 = copyCallback();
      action2.do();

      expect(clipboard.hasData).toBe(false);
      expect(clipboard.annotations).toBeNull();
      expect(clipboard.copyFrame).toBe(0);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledTimes(1); // only from the first copy
    });

    it("clears clipboard when selection doesn't cover copyFrame", () => {
      const bboxAnn = makeAnn("bbox-001");
      mockDataItems.push(bboxAnn);
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 15;

      const { copyCallback } = registerCommands();
      const action1 = copyCallback();
      action1.do();
      expect(clipboard.hasData).toBe(true);

      mockSelectedAnnotationIds.clear();
      const outOfRangeAnn = makeAnn("out-001", {
        shape: {
          type: "idah-video:bounding-box",
          start: 50,
          end: 60,
          frames: [
            { frame: 50, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 55, angle: 0, points: [[10, 10], [90, 90]] },
            { frame: 60, angle: 0, points: [[20, 20], [80, 80]] },
          ],
        },
      });
      mockDataItems.push(outOfRangeAnn);
      mockSelectedAnnotationIds.add("out-001");

      const action2 = copyCallback();
      action2.do();

      expect(clipboard.hasData).toBe(false);
      expect(clipboard.annotations).toBeNull();
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledTimes(1); // only from the first copy
    });

    it("does NOT clear clipboard on empty-selection no-op", () => {
      const bboxAnn = makeAnn("bbox-001");
      mockDataItems.push(bboxAnn);
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 15;

      const { copyCallback } = registerCommands();
      const action1 = copyCallback();
      action1.do();
      expect(clipboard.hasData).toBe(true);

      mockSelectedAnnotationIds.clear();

      const action2 = copyCallback();
      action2.do();

      expect(clipboard.hasData).toBe(true);
      expect(clipboard.annotations).toHaveLength(1);
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("paste is a no-op after a failed copy cleared the clipboard", async () => {
      const bboxAnn = makeAnn("bbox-001");
      mockDataItems.push(bboxAnn);
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 15;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction1 = copyCallback();
      copyAction1.do();
      expect(clipboard.hasData).toBe(true);

      mockSelectedAnnotationIds.clear();
      const outOfRangeAnn = makeAnn("out-001", {
        shape: {
          type: "idah-video:bounding-box",
          start: 50,
          end: 60,
          frames: [
            { frame: 50, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 55, angle: 0, points: [[10, 10], [90, 90]] },
            { frame: 60, angle: 0, points: [[20, 20], [80, 80]] },
          ],
        },
      });
      mockDataItems.push(outOfRangeAnn);
      mockSelectedAnnotationIds.add("out-001");
      const copyAction2 = copyCallback();
      copyAction2.do();
      expect(clipboard.hasData).toBe(false);

      const pasteAction = pasteCallback();
      expect(pasteAction.command.name).toBe("idah-video:selection.paste");
      await pasteAction.do();
      expect(mockCreateFn).not.toHaveBeenCalled();
    });
  });

  // ── Group copy/paste ─────────────────────────────────────────────────────

  describe("group copy/paste", () => {
    const GROUP_ID = "test-group-001";

    function makeTrackSegments() {
      const segA = {
        id: "seg-a",
        metadata: { group_id: GROUP_ID },
        shape: {
          type: "idah-video:bounding-box",
          start: 0,
          end: 10,
          frames: [
            { frame: 0, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 5, angle: 0, points: [[10, 10], [90, 90]] },
            { frame: 10, angle: 0, points: [[20, 20], [80, 80]] },
          ],
        },
        value: { category: "test/cat" },
      };
      const segB = {
        id: "seg-b",
        metadata: { group_id: GROUP_ID },
        shape: {
          type: "idah-video:bounding-box",
          start: 11,
          end: 20,
          frames: [
            { frame: 11, angle: 0, points: [[30, 30], [70, 70]] },
            { frame: 15, angle: 0, points: [[40, 40], [60, 60]] },
            { frame: 20, angle: 0, points: [[50, 50], [50, 50]] },
          ],
        },
        value: { category: "test/cat" },
      };
      return [segA, segB];
    }

    it("group copy succeeds with a partial anchor (only one segment covers copyFrame)", () => {
      const [segA, segB] = makeTrackSegments();
      mockDataItems.push(segA, segB);
      mockSelectedGroupIds.add(GROUP_ID);
      mockCurrentFrameValue.value = 5;

      const { copyCallback } = registerCommands();
      const action = copyCallback();
      action.do();

      expect(clipboard.hasData).toBe(true);
      expect(clipboard.annotations).toHaveLength(2);
      const ids = clipboard.annotations!.map((e) => (e.shape as any).start);
      expect(ids).toContain(0);
      expect(ids).toContain(11);
      expect(clipboard.copyFrame).toBe(5);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copied", description: "2 annotation(s) copied" }),
      );
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("group copy fails when no segment covers the playhead", () => {
      const [segA, segB] = makeTrackSegments();
      mockDataItems.push(segA, segB);
      mockSelectedGroupIds.add(GROUP_ID);
      mockCurrentFrameValue.value = 30;

      const { copyCallback } = registerCommands();
      const action = copyCallback();
      action.do();

      expect(clipboard.hasData).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed" }),
      );
    });

    it("individually selecting one segment still enforces the strict rule", () => {
      const [segA] = makeTrackSegments();
      mockDataItems.push(segA);
      mockSelectedAnnotationIds.add("seg-a");
      mockCurrentFrameValue.value = 15;

      const { copyCallback } = registerCommands();
      const action = copyCallback();
      action.do();

      expect(clipboard.hasData).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copy failed" }),
      );
    });

    it("paste preserves relative timing across segments", async () => {
      const [segA, segB] = makeTrackSegments();
      mockDataItems.push(segA, segB);
      mockSelectedGroupIds.add(GROUP_ID);
      mockCurrentFrameValue.value = 5;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      mockCurrentFrameValue.value = 20;

      const pasteAction = pasteCallback();
      await pasteAction.do();

      expect(mockCreateFn).toHaveBeenCalledTimes(2);
      const firstCallGroup = mockCreateFn.mock.calls[0][0].metadata?.group_id;
      const secondCallGroup = mockCreateFn.mock.calls[1][0].metadata?.group_id;
      expect(firstCallGroup).toBe(secondCallGroup);
      expect(firstCallGroup).toMatch(/^test-uuid-/);

      const shapeA = mockCreateFn.mock.calls[0][0].shape;
      const shapeB = mockCreateFn.mock.calls[1][0].shape;
      expect(shapeA.start).toBe(15);
      expect(shapeA.end).toBe(25);
      expect(shapeB.start).toBe(26);
      expect(shapeB.end).toBe(35);
      expect(shapeB.start - shapeA.end).toBe(1);

      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Pasted", description: "2 annotation(s) pasted" }),
      );
    });

    it("paste near video edge drops only the segment that goes fully out of bounds", async () => {
      const shortSegA = {
        id: "seg-a",
        metadata: { group_id: GROUP_ID },
        shape: {
          type: "idah-video:bounding-box",
          start: 0,
          end: 5,
          frames: [
            { frame: 0, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 5, angle: 0, points: [[10, 10], [90, 90]] },
          ],
        },
        value: { category: "test/cat" },
      };
      const shortSegB = {
        id: "seg-b",
        metadata: { group_id: GROUP_ID },
        shape: {
          type: "idah-video:bounding-box",
          start: 90,
          end: 99,
          frames: [
            { frame: 90, angle: 0, points: [[30, 30], [70, 70]] },
            { frame: 99, angle: 0, points: [[40, 40], [60, 60]] },
          ],
        },
        value: { category: "test/cat" },
      };
      mockDataItems.push(shortSegA, shortSegB);
      mockSelectedGroupIds.add(GROUP_ID);
      mockCurrentFrameValue.value = 3;

      const { copyCallback, pasteCallback } = registerCommands();
      const copyAction = copyCallback();
      copyAction.do();
      expect(clipboard.hasData).toBe(true);

      mockCurrentFrameValue.value = 98;

      const pasteAction = pasteCallback();
      await pasteAction.do();

      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      const createdShape = mockCreateFn.mock.calls[0][0].shape;
      expect(createdShape.start).toBe(95);
      expect(createdShape.end).toBe(99); // clamped to MAX_FRAME

      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Pasted",
          description: expect.stringContaining("1 of 2"),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledTimes(1); // from copy step only
    });
  });

  // ── Selection restored after paste ─────────────────────────────────────

  describe("paste restores the copy-time selection kind", () => {
    const TRACK_ID = "track-sel-1";

    function makeGroupedSegment(id: string, start: number, end: number): any {
      return {
        id,
        metadata: { group_id: TRACK_ID },
        shape: {
          type: "idah-video:bounding-box",
          start,
          end,
          frames: [
            { frame: start, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: end, angle: 0, points: [[10, 10], [90, 90]] },
          ],
        },
        value: { category: "test/cat" },
      };
    }

    it("selects the new group when a group was copied", async () => {
      mockDataItems.push(makeGroupedSegment("seg-a", 0, 10), makeGroupedSegment("seg-b", 20, 30));
      mockSelectedGroupIds.add(TRACK_ID);
      mockCurrentFrameValue.value = 5;

      const { copyCallback, pasteCallback } = registerCommands();
      copyCallback().do();

      mockCurrentFrameValue.value = 40;
      await pasteCallback().do();

      expect(mockCreateFn).toHaveBeenCalledTimes(2);
      const newGroupId = mockCreateFn.mock.calls[0][0].metadata.group_id;

      expect(clipboard.selectionKind).toBe("group");
      // Both segments share one new group id → a single group is selected.
      expect(mockSelectGroups).toHaveBeenCalledTimes(1);
      expect(mockSelectGroups).toHaveBeenCalledWith([newGroupId]);
      expect(mockSelectAnnotations).not.toHaveBeenCalled();
      expect(mockAddAnnotations).not.toHaveBeenCalled();
    });

    it("selects the new annotations when individual annotations were copied", async () => {
      mockDataItems.push(makeAnn("bbox-001"), makeAnn("bbox-002"));
      mockSelectedAnnotationIds.add("bbox-001");
      mockSelectedAnnotationIds.add("bbox-002");
      mockCurrentFrameValue.value = 15;

      const { copyCallback, pasteCallback } = registerCommands();
      copyCallback().do();
      await pasteCallback().do();

      expect(mockCreateFn).toHaveBeenCalledTimes(2);
      const createdIds = mockCreateFn.mock.calls.map((c: any[]) => c[0].id);

      expect(clipboard.selectionKind).toBe("annotation");
      expect(mockSelectAnnotations).toHaveBeenCalledTimes(1);
      expect(mockSelectAnnotations).toHaveBeenCalledWith(createdIds);
      expect(mockSelectGroups).not.toHaveBeenCalled();
    });

    it("treats a group selection as the whole copy, even if annotation ids linger", async () => {
      // Selection is either a group or annotations, never both — but the two
      // sets are independent, so pin down which one wins.
      const lone = makeAnn("bbox-001", {
        shape: {
          type: "idah-video:bounding-box",
          start: 12,
          end: 18,
          frames: [
            { frame: 12, angle: 0, points: [[0, 0], [100, 100]] },
            { frame: 18, angle: 0, points: [[10, 10], [90, 90]] },
          ],
        },
      });
      mockDataItems.push(makeGroupedSegment("seg-a", 10, 20), lone);
      mockSelectedGroupIds.add(TRACK_ID);
      mockSelectedAnnotationIds.add("bbox-001");
      mockCurrentFrameValue.value = 15;

      const { copyCallback, pasteCallback } = registerCommands();
      copyCallback().do();

      // Only the group member is copied; the stray annotation is ignored.
      expect(clipboard.selectionKind).toBe("group");
      expect(clipboard.annotations).toHaveLength(1);
      expect((clipboard.annotations![0].shape as any).start).toBe(10);

      await pasteCallback().do();

      expect(mockCreateFn).toHaveBeenCalledTimes(1);
      expect(mockSelectGroups).toHaveBeenCalledWith([mockCreateFn.mock.calls[0][0].metadata.group_id]);
      expect(mockSelectAnnotations).not.toHaveBeenCalled();
      expect(mockAddAnnotations).not.toHaveBeenCalled();
    });
  });
});
