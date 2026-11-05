// ---------------------------------------------------------------------------
// V2 IdahDriver — the main in-memory mock driver hub
// ---------------------------------------------------------------------------
import type {
  IAccountSettingsDriverV2,
  ISettingsDriverV2,
  IAnnotationRecord,
  IAnnotationsDriverV2,
  ICommandAction,
  ICommandDescriptor,
  ICommandDriverV2,
  ICommandStackEntry,
  IConfig,
  IFilter,
  IAnnotationChange,
  IChangesQuery,
  IChangesResult,
  IIdahDriverV2,
  IMediaInfo,
  IModeEvent,
  INoteAnchor,
  INoteRecord,
  INotesDriverV2,
  INoteScreenPosition,
  IShapeConfig,
  IShortcut,
  ISyncErrorEvent,
  ISyncEvent,
  IToolbarDriverV2,
  ToolbarItemOptions,
  Unsubscribe,
} from "$idah/v2/types";
import { DEFAULT_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, REVIEW_MODE, type IImageAnnotationShape, type IImageAnnotationValue } from "$lib/types";

import { modKey } from "$lib/utils/browser";
import { uuidv7 } from "uuidv7";
import type { ChangeEntry } from "$lib/utils/diff-lines";
import { AstProcessor } from "./ast-evaluator";
import { AccountSettingsManager } from "./account-settings-manager.svelte";
import { CommandManagerV2 } from "./command-manager";
import { InMemoryStore } from "./in-memory-store";
import { ToolbarManagerV2 } from "./toolbar-manager";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
type SampleAnnotation = IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue>;

const SAMPLE_ANNOTATIONS: SampleAnnotation[] = [
  {
    id: uuidv7(),
    shape_type: IMAGE_BOUNDING_BOX,
    shape_args: {
      points: [
        [0.030237486417802006, 0.2333274536145938],
        [0.03965013702021159, 0.2333274536145938],
        [0.03965013702021159, 0.24533327001214162],
        [0.030237486417802006, 0.24533327001214162],
      ],
      angle: 0,
    } as IImageAnnotationShape,
    category: "vehicles/car",
  },
  {
    id: uuidv7(),
    shape_type: "idah-image:polygon",
    shape_args: {
      points: [
        [0.39446366782006914, 0.6193771626297577],
        [0.3391003460207612, 0.6159169550173011],
        [0.3241061130334486, 0.7197231833910035],
        [0.38638985005767007, 0.7283737024221454],
        [0.4025374855824682, 0.6972318339100346],
      ],
      angle: 0,
    } as IImageAnnotationShape,
    category: "pedestrian",
  },
];

const SAMPLE_NOTES: INoteRecord[] = [
  {
    id: "note-v2-001",
    anchor: {
      annotation_id: "ann-v2-001",
      anchor_type: "annotation",
      position: { x: 0.5, y: 0.5 },
    },
    content_md: "Check this car — front bumper unclear",
    status: "pending",
  },
  {
    id: "note-v2-002",
    anchor: {
      annotation_id: "ann-v2-002",
      anchor_type: "annotation",
      position: { x: 0.3, y: 0.7 },
    },
    content_md: "Bus has a logo on the side",
    status: "pending",
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
type Annot = IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue>;

class AnnotationsDriverAdapter implements IAnnotationsDriverV2<IImageAnnotationShape, IImageAnnotationValue> {
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

  async restore(id: string): Promise<Annot> {
    const restored = this.store.restore(id);
    const version = this.nextVersion(id);
    this.recordChange(restored, "restored", version, [["~", "deleted_at", new Date().toISOString(), null]]);
    return restored;
  }

  async create(data: Annot): Promise<Annot> {
    const created = this.store.create(data);
    this.recordChange(created, "created", 1, baselineChanges(created));
    return created;
  }

  async setShape(annotationId: string, key: string, value: object | null): Promise<void> {
    // Record a change row and keep the store in sync, like the backend does:
    // write_shapes records one `shape_args.<tile key>` entry per tile written.
    const before = this.store.find(annotationId);
    if (!before) return;
    const shape = { ...(before.shape_args as Record<string, unknown>) };
    if (value === null) {
      delete shape[key];
    } else {
      shape[key] = value;
    }
    this.store.update(annotationId, { shape_args: shape } as Partial<Annot>);
    const after = this.store.find(annotationId);
    if (after) {
      const version = this.nextVersion(annotationId);
      this.recordChange(after, "updated", version, [
        ["~", `shape_args.${escapeKey(key)}`, before.shape_args[key], after.shape_args[key] ?? null],
      ]);
    }
  }

  async setShapes(annotationId: string, entries: Array<{ key: string; value: object | null }>): Promise<void> {
    if (entries.length === 0) return;
    const before = this.store.find(annotationId);
    if (!before) return;
    const shape = { ...(before.shape_args as Record<string, unknown>) };
    for (const { key, value } of entries) {
      if (value === null) {
        delete shape[key];
      } else {
        shape[key] = value;
      }
    }
    this.store.update(annotationId, { shape_args: shape } as Partial<Annot>);
    const after = this.store.find(annotationId);
    if (after) {
      const version = this.nextVersion(annotationId);
      const changes = entries.map(({ key, value }) => {
        const old = before.shape_args[key] ?? null;
        const fresh = value === null ? null : after.shape_args[key] ?? null;
        return ["~", `shape_args.${escapeKey(key)}`, old, fresh] as ChangeEntry;
      });
      this.recordChange(after, "updated", version, changes);
    }
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

/** Escape a plain path segment the way the backend's AnnotationDiff.escape does. */
function escapeKey(key: string): string {
  return key.replace(/([.\[\]\\])/g, "\\$1");
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
// Adapter: notes — push-based observer interface
// ---------------------------------------------------------------------------
class NotesDriverAdapter implements INotesDriverV2 {
  private notesChangeListeners: Set<(notes: INoteRecord[]) => void> = new Set();
  private focusNoteListeners: Set<(note: INoteRecord | null) => void> = new Set();

  constructor(private store: InMemoryStore<INoteRecord>) {}

  onNotesChange(cb: (notes: INoteRecord[]) => void): Unsubscribe {
    this.notesChangeListeners.add(cb);
    cb(this.store.all());
    return () => this.notesChangeListeners.delete(cb);
  }

  onFocusNote(cb: (note: INoteRecord | null) => void): Unsubscribe {
    this.focusNoteListeners.add(cb);
    return () => this.focusNoteListeners.delete(cb);
  }

  reportNotePosition(_position: INoteScreenPosition): void {
    // Mock — no-op
  }

  selectNote(_noteId: string | null): void {
    // Mock — no-op
  }

  requestCreateNote(_anchor: INoteAnchor): void {
    // Mock — no-op
  }
}

// ---------------------------------------------------------------------------
// Main IdahDriverV2
// ---------------------------------------------------------------------------
export class IdahDriverV2 implements IIdahDriverV2<IImageAnnotationShape, IImageAnnotationValue> {
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
    IMAGE_BOUNDING_BOX: {
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
      ],
    },
    "idah-image:polygon": {
      values: [
        { id: "road-sign", color: "#FFD600", label: "Road Sign", text_color: "#000000", description: "A road sign" },
        {
          id: "traffic-light",
          color: "#FF6D00",
          label: "Traffic Light",
          text_color: "#FFFFFF",
          description: "A traffic light",
        },
        { id: "pedestrian", color: "#AA00FF", label: "Pedestrian", text_color: "#FFFFFF", description: "A pedestrian" },
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
  readonly annotations: IAnnotationsDriverV2<IImageAnnotationShape, IImageAnnotationValue>;
  readonly notes: INotesDriverV2;
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
    mime_type: "image/jpeg",
    filename: "mock-image.jpg",
    url: "/mock-image.jpg",
    meta: { duration: 0, fps: 0, width: 1920, height: 1080 },
  };
  private _workflowStep = "annotate";
  private _entryStatus = "in_progress";
  private _mode = DEFAULT_MODE;
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

    // STUB (standalone dev): accept setting registrations but render nothing —
    // the topbar that consumes these lives in core, not in this mock harness.
    this.settings = {
      register: () => {},
      invalidate: () => {},
    };

    // Hand the live override map to the dispatcher. AccountSettingsManager
    // mutates it in place, so the dispatcher sees overrides without re-wiring.
    this.commandMgr.attachOverrides(this.accountSettingsMgr.getShortcutOverrides());

    // ── Register default idah commands ────────────────────────────────

    const cmdMgr = this.commandMgr;
    const driver = this;

    this.command.register({
      name: "core:history.undo",
      group: "General",
      modes: [DEFAULT_MODE, REVIEW_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, "note"],
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
      modes: [DEFAULT_MODE, REVIEW_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, "note"],
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
      modes: [DEFAULT_MODE, REVIEW_MODE, IMAGE_BOUNDING_BOX, IMAGE_POLYGON, "note"],
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
          driver.setMode(DEFAULT_MODE);
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
