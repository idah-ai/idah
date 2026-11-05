// ---------------------------------------------------------------------------
// V2 IdahDriver — the main in-memory mock driver hub
// ---------------------------------------------------------------------------
import type {
  IIdahDriverV2,
  IMediaInfo,
  IConfig,
  IShapeConfig,
  IAnnotationsDriverV2,
  INotesDriverV2,
  ICommandDriverV2,
  IToolbarDriverV2,
  IStatsDriverV2,
  ISettingsDriverV2,
  IAccountSettingsDriverV2,
  IStatProvider,
  IAnnotationRecord,
  INoteRecord,
  INoteAnchor,
  INoteScreenPosition,
  IFilter,
  IAnnotationChange,
  IChangesQuery,
  IChangesResult,
  ICommandAction,
  ICommandDescriptor,
  IModeEvent,
  ISyncEvent,
  ISyncErrorEvent,
  IShortcut,
  ICommandStackEntry,
  ToolbarItemOptions,
  Unsubscribe,
} from "$idah/v2/types";
import type { IVideoAnnotationShape, IVideoAnnotationValue, IVideoFrameSelection } from "$lib/types";

import { InMemoryStore } from "./in-memory-store";
import { CommandManagerV2 } from "./command-manager";
import { ToolbarManagerV2 } from "./toolbar-manager";
import { AccountSettingsManager } from "./account-settings-manager.svelte";
import { AstProcessor } from "./ast-evaluator";
import { modKey } from "$lib/utils/browser";
import type { ChangeEntry } from "$lib/utils/diff-lines";
import { uuidv7 } from "uuidv7";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
type SampleAnnotation = IAnnotationRecord<IVideoAnnotationShape, IVideoAnnotationValue>;

const SAMPLE_ANNOTATIONS: SampleAnnotation[] = [
  {
    id: uuidv7(),
    shape_type: "idah-video:bounding-box",
    shape_args: {
      start: 0,
      end: 120,
      frames: [
        // Person moving toward camera increasing height and width, with no rotation
        {
          frame: 0,
          points: [
            [0.7, 0.3],
            [0.75, 0.3],
            [0.75, 0.5],
            [0.7, 0.5],
          ],
          angle: 0,
        },
        {
          frame: 60,
          points: [
            [0.68, 0.28],
            [0.77, 0.28],
            [0.77, 0.52],
            [0.68, 0.52],
          ],
          angle: 0,
        },
        {
          frame: 120,
          points: [
            [0.65, 0.25],
            [0.8, 0.25],
            [0.8, 0.55],
            [0.65, 0.55],
          ],
          angle: 0,
        },
      ],
    } as IVideoAnnotationShape,
    category: "person",
  },
  {
    id: uuidv7(),
    shape_type: "idah-video:bounding-box",
    shape_args: {
      start: 0,
      end: 120,
      frames: [
        {
          frame: 0,
          points: [
            [0.2, 0.3],
            [0.45, 0.3],
            [0.45, 0.5],
            [0.2, 0.5],
          ],
          angle: 0,
        },
        {
          frame: 60,
          points: [
            [0.22, 0.28],
            [0.48, 0.28],
            [0.48, 0.52],
            [0.22, 0.52],
          ],
          angle: 2,
        },
        {
          frame: 120,
          points: [
            [0.25, 0.25],
            [0.5, 0.25],
            [0.5, 0.55],
            [0.25, 0.55],
          ],
          angle: 3,
        },
      ],
    } as IVideoAnnotationShape,
    category: "vehicles/car",
  },
  {
    id: uuidv7(),
    shape_type: "idah-video:bounding-box",
    shape_args: {
      start: 50,
      end: 300,
      frames: [
        {
          frame: 50,
          points: [
            [0.6, 0.4],
            [0.8, 0.4],
            [0.8, 0.7],
            [0.6, 0.7],
          ],
          angle: 0,
        },
        {
          frame: 150,
          points: [
            [0.58, 0.38],
            [0.78, 0.38],
            [0.78, 0.68],
            [0.58, 0.68],
          ],
          angle: -1,
        },
        {
          frame: 300,
          points: [
            [0.55, 0.35],
            [0.75, 0.35],
            [0.75, 0.65],
            [0.55, 0.65],
          ],
          angle: -2,
        },
      ],
    } as IVideoAnnotationShape,
    category: "vehicles/bus",
  },
  {
    id: uuidv7(),
    shape_type: "idah-video:polygon",
    shape_args: {
      start: 30,
      end: 190,
      frames: [
        // Frame 30 — trapezoid (4 vertices)
        {
          frame: 30,
          angle: 0,
          points: [
            [0.12, 0.05],
            [0.38, 0.05],
            [0.42, 0.35],
            [0.08, 0.35],
          ],
        },
        // Frame 110 — 5-pointed star (10 vertices)
        {
          frame: 110,
          angle: 0,
          points: [
            [0.25, 0.05],
            [0.285, 0.151],
            [0.393, 0.154],
            [0.307, 0.219],
            [0.338, 0.321],
            [0.25, 0.26],
            [0.162, 0.321],
            [0.193, 0.219],
            [0.107, 0.154],
            [0.215, 0.151],
          ],
        },
        // Frame 190 — crescent
        {
          frame: 190,
          angle: 0,
          points: [
            [0.288984375, 0.3175],
            [0.263671875, 0.34],
            [0.23554687500000002, 0.3425],
            [0.208828125, 0.325],
            [0.1884375, 0.29],
            [0.1771875, 0.24375],
            [0.1771875, 0.19375],
            [0.1884375, 0.1475],
            [0.208828125, 0.1125],
            [0.23554687500000002, 0.095],
            [0.263671875, 0.0975],
            [0.288984375, 0.12],
            [0.263671875, 0.1125],
            [0.2390625, 0.125],
            [0.21937500000000001, 0.155],
            [0.208828125, 0.19625],
            [0.208828125, 0.24125],
            [0.21937500000000001, 0.2825],
            [0.2390625, 0.3125],
            [0.263671875, 0.325],
          ],
        },
      ],
    } as IVideoAnnotationShape,
    category: "road-sign",
  },
  {
    id: uuidv7(),
    shape_type: "idah-video:polygon",
    shape_args: {
      start: 0,
      end: 200,
      frames: [
        // Circle approximation with 20 vertices
        {
          frame: 0,
          angle: 0,
          points: Array.from({ length: 20 }, (_, i) => {
            const theta = (i / 20) * 2 * Math.PI;
            return [0.5 + 0.1 * Math.cos(theta), 0.5 + 0.1 * Math.sin(theta)];
          }),
        },
        // Ellipse approximation with 15
        {
          frame: 100,
          angle: 0,
          points: Array.from({ length: 15 }, (_, i) => {
            const theta = (i / 15) * 2 * Math.PI;
            return [0.5 + 0.15 * Math.cos(theta), 0.5 + 0.05 * Math.sin(theta)];
          }),
        },
        // Irregular blob with 18 vertices
        {
          frame: 200,
          angle: 0,
          points: [
            [0.4, 0.5],
            [0.45, 0.55],
            [0.5, 0.52],
            [0.55, 0.58],
            [0.6, 0.5],
            [0.58, 0.45],
            [0.62, 0.4],
            [0.57, 0.38],
            [0.53, 0.32],
            [0.48, 0.35],
            [0.43, 0.3],
            [0.4, 0.35],
            [0.35, 0.33],
            [0.32, 0.37],
            [0.3, 0.42],
            [0.33, 0.47],
            [0.28, 0.52],
            [0.38, 0.48],
          ],
        },
      ],
    } as IVideoAnnotationShape,
    category: "person",
  },
];

const SAMPLE_NOTES: INoteRecord[] = [
  {
    id: "note-v2-001",
    anchor: {
      annotation_id: "ann-v2-001",
      anchor_type: "annotation",
      position: { x: 0.5, y: 0.3 },
    },
    content_md: "Check this car — front bumper unclear",
    resolved: false,
  },
  {
    id: "note-v2-002",
    anchor: {
      annotation_id: "ann-v2-002",
      anchor_type: "annotation",
    },
    content_md: "Bus has a logo on the side",
    resolved: false,
  },
];

// ---------------------------------------------------------------------------
// Adapter: command driver → ICommandDriverV2
// ---------------------------------------------------------------------------
class CommandDriverAdapter implements ICommandDriverV2 {
  #paletteOpen = false;
  #paletteListeners: Set<(open: boolean) => void> = new Set();

  constructor(private mgr: CommandManagerV2) {}

  isPaletteOpen(): boolean {
    return this.#paletteOpen;
  }

  openPalette(open?: boolean): void {
    this.#paletteOpen = open !== undefined ? open : !this.#paletteOpen;
    for (const cb of this.#paletteListeners) cb(this.#paletteOpen);
  }

  onPaletteChange(cb: (open: boolean) => void): () => void {
    this.#paletteListeners.add(cb);
    return () => this.#paletteListeners.delete(cb);
  }

  register(opts: {
    name: string;
    modes: string[];
    shortcut: IShortcut | null;
    shortDescription: string | null;
    longDescription: string | null;
    callback: (opts?: Record<string, unknown>) => ICommandAction;
    group?: string;
    activeWhen?: () => boolean;
  }): void {
    this.mgr.register(opts);
  }

  call(name: string, ...opts: Record<string, unknown>[]): void {
    this.mgr.call(name, ...opts);
  }

  undo(count?: number): boolean {
    return this.mgr.undo(count);
  }

  redo(count?: number): boolean {
    return this.mgr.redo(count);
  }

  canUndo(): boolean {
    return this.mgr.canUndo();
  }

  canRedo(): boolean {
    return this.mgr.canRedo();
  }

  history(n?: number): { undo: ICommandStackEntry[]; redo: ICommandStackEntry[] } {
    return this.mgr.history(n);
  }

  getActiveCommands(): ICommandDescriptor[] {
    return this.mgr.getActiveCommands();
  }

  getCommand(name: string): ICommandDescriptor | undefined {
    return this.mgr.getCommand(name);
  }

  getShortcut(name: string): string | undefined {
    return this.mgr.getShortcut(name);
  }

  getAllCommands(currentMode?: string): Map<string, ICommandDescriptor[]> {
    return this.mgr.getAllCommands(currentMode);
  }

  resolveKeyEvent(event: KeyboardEvent, mode: string): boolean {
    return this.mgr.resolveKeyEvent(event, mode);
  }

  getKeyMapForMode(mode: string): Record<string, string> {
    return this.mgr.getKeyMapForMode(mode);
  }

  getShortcutReferences(): Record<string, { label: string; description: string; keyCombinations: string[] }> {
    return this.mgr.getShortcutReferences();
  }
}

// ---------------------------------------------------------------------------
// Adapter: toolbar driver → IToolbarDriverV2
// ---------------------------------------------------------------------------
class ToolbarDriverAdapter implements IToolbarDriverV2 {
  constructor(private mgr: ToolbarManagerV2) {}

  add(options: ToolbarItemOptions): void {
    this.mgr.add(options);
  }

  orderGroups(mode: string, groups: string[]): void {
    this.mgr.orderGroups(mode, groups);
  }

  get revision(): number {
    return this.mgr.revision;
  }

  invalidate(): void {
    this.mgr.invalidate();
  }
}

// ---------------------------------------------------------------------------
// Adapter: annotations
// ---------------------------------------------------------------------------
type Annot = IAnnotationRecord<IVideoAnnotationShape, IVideoAnnotationValue>;

class AnnotationsDriverAdapter implements IAnnotationsDriverV2<IVideoAnnotationShape, IVideoAnnotationValue> {
  private changeRows: IAnnotationChange[] = [];
  private versionCounter = new Map<string, number>();

  constructor(private store: InMemoryStore<Annot>) {
    // Seed a baseline row for every fixture annotation.
    for (const ann of store.all()) {
      this.recordChange(ann, "baseline", 1, baselineChanges(ann));
    }
  }

  registerField(name: string, fn: (ann: Annot) => unknown): void {
    this.store.registerField(name, fn);
  }

  async fetch(filter?: IFilter): Promise<Annot[]> {
    return this.store.fetch(filter);
  }

  async update(id: string, data: Partial<Annot>): Promise<void> {
    const before = this.store.find(id);
    this.store.update(id, data);
    const after = this.store.find(id);
    if (before && after) {
      const version = this.nextVersion(id);
      this.recordChange(after, "updated", version, diffChanges(before, after));
    }
  }

  async delete(id: string): Promise<void> {
    const before = this.store.find(id);
    this.store.delete(id);
    if (before) {
      const version = this.nextVersion(id);
      this.recordChange(before, "deleted", version, [["~", "deleted_at", null, new Date().toISOString()]]);
    }
  }

  async restore(id: string): Promise<void> {
    const restored = this.store.restore(id);
    const version = this.nextVersion(id);
    this.recordChange(restored, "restored", version, [["~", "deleted_at", new Date().toISOString(), null]]);
  }

  async create(data: Annot): Promise<Annot> {
    const created = this.store.create(data);
    this.recordChange(created, "created", 1, baselineChanges(created));
    return created;
  }

  // ── Annotation change history (mock) ──────────────────────────────────

  async changes(query?: IChangesQuery): Promise<IChangesResult> {
    const { filters = {}, page = 1, size = 50, fields, count = true } = query ?? {};
    let items = this.changeRows;
    if (filters.annotation_id__in?.length) {
      const set = new Set(filters.annotation_id__in);
      items = items.filter((c) => set.has(c.annotation_id));
    }
    if (filters.id__in?.length) {
      const set = new Set(filters.id__in);
      items = items.filter((c) => set.has(c.id));
    }
    if (filters.changed_at__lte !== undefined) {
      items = items.filter((c) => c.changed_at <= filters.changed_at__lte!);
    }
    if (filters.changed_at__gte !== undefined) {
      items = items.filter((c) => c.changed_at >= filters.changed_at__gte!);
    }
    if (filters.op__in?.length) {
      const set = new Set(filters.op__in);
      items = items.filter((c) => set.has(c.op));
    }
    const includeChanges = fields?.includes("changes") ?? false;
    const total = items.length;
    const start = (page - 1) * size;
    const pageItems = items.slice(start, start + size);
    return {
      items: pageItems.map((c) => (includeChanges ? c : omitChanges(c))),
      total: count ? total : pageItems.length,
    };
  }

  async version(id: string, version: number): Promise<Annot> {
    throw new Error("version() is not supported in the mock driver");
  }

  private nextVersion(id: string): number {
    const v = (this.versionCounter.get(id) ?? 1) + 1;
    this.versionCounter.set(id, v);
    return v;
  }

  private recordChange(ann: Annot, op: IAnnotationChange["op"], version: number, changes: ChangeEntry[]) {
    this.changeRows.unshift({
      id: uuidv7(),
      annotation_id: ann.id,
      account_id: 1,
      account_email: "mock@example.com",
      op,
      version,
      changed_at: Date.now(),
      changes,
    });
  }
}

function omitChanges(c: IAnnotationChange): IAnnotationChange {
  const { changes: _omit, ...rest } = c;
  return rest;
}

function baselineChanges(ann: Annot): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  out.push(["+", "shape_type", null, ann.shape_type]);
  out.push(["+", "category", null, ann.category]);
  if (ann.shape_args) out.push(["+", "shape_args", null, ann.shape_args]);
  if (ann.properties) out.push(["+", "properties", null, ann.properties]);
  return out;
}

function diffChanges(before: Annot, after: Annot): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  if (before.category !== after.category) {
    out.push(["~", "category", before.category, after.category]);
  }
  if (JSON.stringify(before.shape_args) !== JSON.stringify(after.shape_args)) {
    out.push(["~", "shape_args", before.shape_args, after.shape_args]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter: notes — Observer-based (mock)
// ---------------------------------------------------------------------------
class NotesDriverAdapter implements INotesDriverV2 {
  private notesChangeListeners: Set<(notes: INoteRecord[]) => void> = new Set();
  private focusNoteListeners: Set<(note: INoteRecord | null) => void> = new Set();

  constructor(private store: InMemoryStore<INoteRecord>) {}

  // ── Core → Plugin observers ────────────────────────────────────────────

  onNotesChange(cb: (notes: INoteRecord[]) => void): Unsubscribe {
    this.notesChangeListeners.add(cb);
    queueMicrotask(() => {
      cb(this.store.all());
    });
    return () => this.notesChangeListeners.delete(cb);
  }

  onFocusNote(cb: (note: INoteRecord | null) => void): Unsubscribe {
    this.focusNoteListeners.add(cb);
    return () => this.focusNoteListeners.delete(cb);
  }

  // ── Plugin → Core commands ─────────────────────────────────────────────

  reportNotePosition(_position: INoteScreenPosition): void {
    // Mock: no-op
  }

  selectNote(_noteId: string | null): void {
    // Mock: no-op
  }

  requestCreateNote(_anchor: INoteAnchor): void {
    // Mock: no-op
  }

  // ── Mock helpers ────────────────────────────────────────────────────────

  /** Simulate a note being focused by the core. */
  mockFocusNote(note: INoteRecord | null): void {
    for (const cb of this.focusNoteListeners) {
      cb(note);
    }
  }

  /** Simulate notes changing externally. */
  mockEmitNotesChange(): void {
    const notes = this.store.all();
    for (const cb of this.notesChangeListeners) {
      cb(notes);
    }
  }
}

// ---------------------------------------------------------------------------
// Main IdahDriverV2
// ---------------------------------------------------------------------------
export class IdahDriverV2 implements IIdahDriverV2<IVideoAnnotationShape, IVideoAnnotationValue> {
  /** Annotation store */
  readonly annotationStore = new InMemoryStore<Annot>();
  /** Note store */
  readonly noteStore = new InMemoryStore<INoteRecord>();

  /** Command manager (exposed for direct access in the mock page). */
  readonly commandMgr = new CommandManagerV2();

  /** Toolbar manager (exposed for direct access in the mock page). */
  readonly toolbarMgr = new ToolbarManagerV2();

  /** Account settings manager (in-memory; backs command shortcut overrides). */
  readonly accountSettingsMgr = new AccountSettingsManager();

  // ── Default project config ──────────────────────────────────────────
  private _config: IConfig = {
    "idah-video:bounding-box": {
      values: [
        { id: "vehicles/car", color: "#F6402B", label: "Car", text_color: "#FFFFFF", description: "A car" },
        { id: "vehicles/bus", color: "#EB1461", label: "Bus", text_color: "#FFFFFF", description: "A bus" },
        { id: "vehicles/van", color: "#9C1AB2", label: "Van", text_color: "#FFFFFF", description: "A van" },
        { id: "vehicles/truck", color: "#FF8C00", label: "Truck", text_color: "#FFFFFF", description: "A truck" },
        { id: "person", color: "#1464EB", label: "Person", text_color: "#FFFFFF", description: "A person" },
        { id: "cyclist", color: "#00C853", label: "Cyclist", text_color: "#FFFFFF", description: "A cyclist" },
      ],
      properties: [
        {
          id: "wheels",
          type: "integer",
          label: "Number of wheels",
          format: { minimum: 0, maximum: 24, step: 1 },
          required: true,
          visibility: [
            "in",
            [["get", ["category"]], [["vehicles/car", "vehicles/bus", "vehicles/van", "vehicles/truck"]]],
          ] as any,
          description: "How many wheels does the object have?",
        },
        {
          id: "color",
          type: "single-select",
          label: "Color",
          format: {
            options: [
              { id: "red", label: "Red" },
              { id: "blue", label: "Blue" },
              { id: "white", label: "White" },
              { id: "black", label: "Black" },
              { id: "silver", label: "Silver" },
            ],
          },
          required: false,
          visibility: true,
          description: "Primary color of the object",
        },
        {
          id: "occlusion",
          type: "single-select",
          label: "Occlusion",
          format: {
            options: [
              {
                id: "occluded",
                label: "Occluded",
                styles: {
                  opacity: 0,
                },
              },
              {
                id: "partially_occluded",
                label: "Partially Occluded",
                styles: {
                  border: "dashed",
                  opacity: 4,
                },
              },
              {
                id: "semi_occluded",
                label: "Semi Occluded",
                styles: {
                  border: "dotted",
                  opacity: 1,
                },
              },
              {
                id: "not_occluded",
                label: "Not Occluded",
                styles: {},
              },
            ],
          },
          required: false,
          visibility: true,
          description: "",
        },
      ],
    },
    "idah-video:polygon": {
      values: [
        { id: "road-sign", color: "#FFD600", label: "Road Sign", text_color: "#000000", description: "A road sign" },
        {
          id: "traffic-light",
          color: "#FF6D00",
          label: "Traffic Light",
          text_color: "#FFFFFF",
          description: "A traffic light",
        },
        // To test similar categories with different shapes
        { id: "person", color: "#AA00FF", label: "Person", text_color: "#FFFFFF", description: "A person" },
      ],
      properties: [
        {
          id: "occluded",
          type: "boolean",
          label: "Occluded",
          format: {},
          required: true,
          visibility: true,
          description: "Is the object occluded?",
        },
      ],
    },
  };

  // ── Adapters exposed to the user ──────────────────────────────────────

  readonly command: ICommandDriverV2;
  readonly toolbar: IToolbarDriverV2;
  readonly annotations: IAnnotationsDriverV2<IVideoAnnotationShape, IVideoAnnotationValue>;
  readonly notes: INotesDriverV2;
  readonly stats: IStatsDriverV2;
  // STUB (standalone dev): the real settings driver lives in core; the mock only
  // needs to accept registrations so the plugin's registerSettings() call in
  // init() doesn't crash. There's no topbar here, so nothing renders.
  readonly settings: ISettingsDriverV2;
  readonly accountSettings: IAccountSettingsDriverV2;

  // ── Activity context (mutable) ────────────────────────────────────────

  private _id = "mock-entry-v2-001";
  private _media: IMediaInfo = {
    id: "mock-entry-v2-001",
    resource: "mock-entry-v2-001",
    key: "",
    mime_type: "video/mp4",
    filename: "sample.mp4",
    url: "/medias/master.m3u8",
    meta: { duration: 60, fps: 30, width: 1920, height: 1080 },
  };
  private _workflowStep = "annotate";
  private _entryStatus = "in_progress";
  private _mode = "default";
  private _ready = false;

  // ── Callback stores ───────────────────────────────────────────────────

  private readyCallbacks: Set<() => void> = new Set();
  private modeChangeListeners: Set<(event: IModeEvent) => void> = new Set();
  private syncChangeListeners: Set<(event: ISyncEvent) => void> = new Set();
  private syncErrorListeners: Set<(event: ISyncErrorEvent) => void> = new Set();

  constructor() {
    // Seed stores
    this.annotationStore.seed(SAMPLE_ANNOTATIONS);
    this.noteStore.seed(SAMPLE_NOTES);

    // Build adapters
    this.command = new CommandDriverAdapter(this.commandMgr);
    this.toolbar = new ToolbarDriverAdapter(this.toolbarMgr);
    this.annotations = new AnnotationsDriverAdapter(this.annotationStore);
    this.notes = new NotesDriverAdapter(this.noteStore);

    // Account settings — the manager implements IAccountSettingsDriverV2 directly.
    this.accountSettings = this.accountSettingsMgr;

    // Hand the live override map to the dispatcher. AccountSettingsManager
    // mutates it in place, so the dispatcher sees overrides without re-wiring.
    this.commandMgr.attachOverrides(this.accountSettingsMgr.getShortcutOverrides());

    // Minimal stats driver — collects whatever providers register (no core stats in the mock)
    const statProviders: IStatProvider[] = [];
    this.stats = {
      register: (provider: IStatProvider) => statProviders.push(provider),
      collect: async () => (await Promise.all(statProviders.map((p) => p.collect()))).flat(),
    };

    // STUB (standalone dev): accept setting registrations but render nothing —
    // the topbar that consumes these lives in core, not in this mock harness.
    this.settings = {
      register: () => {},
      invalidate: () => {},
    };

    // ── Register default idah commands ────────────────────────────────

    const cmdMgr = this.commandMgr;
    const driver = this;

    this.command.register({
      name: "core:history.undo",
      group: "General",
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
      shortcut: "Control+Z",
      shortDescription: "Undo",
      longDescription: "Undo the last action",
      callback: () => ({
        command: {
          name: "core:history.undo",
          group: "General",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          cmdMgr.undo();
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      }),
    });

    this.command.register({
      name: "core:history.redo",
      group: "General",
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
      shortcut: "Control+Shift+Z",
      shortDescription: "Redo",
      longDescription: "Redo the last undone action",
      callback: () => ({
        command: {
          name: "core:history.redo",
          group: "General",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          cmdMgr.redo();
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      }),
    });

    this.command.register({
      name: "core:mode.exit",
      group: "General",
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
      shortcut: "Escape",
      shortDescription: "Exit current mode",
      longDescription: "Return to the default selection mode",
      callback: () => ({
        command: {
          name: "core:mode.exit",
          group: "General",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          driver.setMode("editor");
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      }),
    });

    // Mark ready after a microtask (simulate async init)
    queueMicrotask(() => {
      this._ready = true;
      for (const cb of this.readyCallbacks) cb();
    });
  }

  // ── Readonly properties ───────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get media(): IMediaInfo {
    return { ...this._media };
  }

  get workflowStep(): string {
    return this._workflowStep;
  }

  get entryStatus(): string {
    return this._entryStatus;
  }

  get mode(): string {
    return this._mode;
  }

  get config(): IConfig {
    return this._config;
  }

  getFilteredConfig(
    shapeType: string,
    value: Record<string, unknown>,
    objectName: string = "",
  ): IShapeConfig | undefined {
    const raw = this._config[shapeType];
    if (!raw) return undefined;
    const ast = new AstProcessor(new Map(this.#objectVariables(value, objectName)));
    return {
      values: raw.values,
      properties: raw.properties.filter((p) => {
        if (typeof p.visibility === "boolean") return p.visibility;
        return ast.processAST(p.visibility);
      }),
    };
  }

  // ── Mode management ───────────────────────────────────────────────────

  setMode(mode: string): void {
    const oldValue = this._mode;
    if (oldValue === mode) return;
    this._mode = mode;
    this.commandMgr.currentMode = mode;

    const event: IModeEvent = { oldValue, newValue: mode };
    for (const cb of this.modeChangeListeners) cb(event);
  }

  onModeChange(cb: (event: IModeEvent) => void): Unsubscribe {
    this.modeChangeListeners.add(cb);
    return () => this.modeChangeListeners.delete(cb);
  }

  // ── Lifecycle callbacks ───────────────────────────────────────────────

  onReady(cb: () => void): void {
    if (this._ready) {
      cb();
    } else {
      this.readyCallbacks.add(cb);
    }
  }

  onSyncChange(cb: (event: ISyncEvent) => void): Unsubscribe {
    this.syncChangeListeners.add(cb);
    return () => this.syncChangeListeners.delete(cb);
  }

  onSyncError(cb: (event: ISyncErrorEvent) => void): Unsubscribe {
    this.syncErrorListeners.add(cb);
    return () => this.syncErrorListeners.delete(cb);
  }

  /** Simulate a sync queue update (call this from the mock page). */
  notifySyncChange(queued: number): void {
    const event: ISyncEvent = { queued };
    for (const cb of this.syncChangeListeners) cb(event);
  }

  /** Simulate a sync error (call this from the mock page). */
  notifySyncError(message: string, code?: string, failedCount?: number): void {
    const event: ISyncErrorEvent = { message, code, failedCount };
    for (const cb of this.syncErrorListeners) cb(event);
  }

  // ── Keyboard dispatch ──────────────────────────────────────────────────

  handleKeydown(event: KeyboardEvent): boolean {
    // Ctrl/Cmd+Space → toggle command palette (handled here, not via command)
    if (modKey(event) && event.code === "Space") {
      event.preventDefault();
      (this.command as CommandDriverAdapter).openPalette();
      return true;
    }

    // only prevent browser if pressed key is handled as a command shortcut
    const handled = this.commandMgr.resolveKeyEvent(event, this._mode);
    if (handled) {
      event.preventDefault();
    }
    return handled;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  #objectVariables(
    obj: Record<string, unknown>,
    root?: string,
  ): [string, string | number | string[] | boolean | undefined][] {
    return Object.entries(obj).reduce<[string, string | number | string[] | boolean | undefined][]>((acc, [k, v]) => {
      if (typeof v === "object" && !Array.isArray(v) && v !== null) {
        acc.push(...this.#objectVariables(v as Record<string, unknown>, root ? `${root}.${k}` : k));
      } else {
        acc.push([root ? `${root}.${k}` : k, v as string | number | string[] | boolean | undefined]);
      }
      return acc;
    }, []);
  }
}
