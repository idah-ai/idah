// ---------------------------------------------------------------------------
// V2 IdahDriver — the main in-memory mock driver hub
// ---------------------------------------------------------------------------
import type {
  IIdahDriverV2, IMediaInfo, IConfig,
  IAnnotationsDriverV2, INotesDriverV2, ICommandDriverV2,
  IToolbarDriverV2, IAnnotationRecord, INoteRecord, IFilter,
  ICommandAction, ICommandDescriptor, IModeEvent, ISyncEvent,
  ISyncErrorEvent, IShortcut, ICommandStackEntry, IToolbarItem,
  ToolbarItemOptions, Unsubscribe,
} from "$idah/v2/types";
import type {
  IVideoAnnotationShape, IVideoAnnotationValue, IVideoFrameSelection,
} from "$idah/v2/video-types";

import { InMemoryStore } from "$idah/v2/in-memory-store";
import { CommandManagerV2 } from "$idah/v2/command-manager";
import { ToolbarManagerV2 } from "$idah/v2/toolbar-manager";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
type SampleAnnotation = IAnnotationRecord<IVideoAnnotationShape, IVideoAnnotationValue>;

const SAMPLE_ANNOTATIONS: SampleAnnotation[] = [
  {
    id: "ann-v2-001",
    shape: {
      type: "idah-video:bounding-box",
      start: 0, end: 120,
      frames: [
        { frame: 0,   aabb: [0.2, 0.3, 0.45, 0.5], angle: 0 },
        { frame: 60,  aabb: [0.22, 0.28, 0.48, 0.52], angle: 2 },
        { frame: 120, aabb: [0.25, 0.25, 0.50, 0.55], angle: 3 },
      ],
    } as IVideoAnnotationShape,
    value: { category: "vehicles/car", label: "car" },
  },
  {
    id: "ann-v2-002",
    shape: {
      type: "idah-video:bounding-box",
      start: 50, end: 300,
      frames: [
        { frame: 50,  aabb: [0.6, 0.4, 0.8, 0.7], angle: 0 },
        { frame: 150, aabb: [0.58, 0.38, 0.78, 0.68], angle: -1 },
        { frame: 300, aabb: [0.55, 0.35, 0.75, 0.65], angle: -2 },
      ],
    } as IVideoAnnotationShape,
    value: { category: "vehicles/bus", label: "bus" },
  },
  {
    id: "ann-v2-003",
    shape: {
      type: "idah-video:polygon",
      start: 30, end: 80,
      frames: [
        { frame: 30,  angle: 0, points: [[0.1, 0.1], [0.3, 0.05], [0.35, 0.2], [0.15, 0.25]] },
        { frame: 55,  angle: 0, points: [[0.12, 0.08], [0.32, 0.04], [0.37, 0.18], [0.17, 0.23]] },
        { frame: 80,  angle: 0, points: [[0.15, 0.05], [0.35, 0.02], [0.40, 0.15], [0.20, 0.20]] },
      ],
    } as IVideoAnnotationShape,
    value: { category: "pedestrian", label: "pedestrian" },
  },
];

const SAMPLE_NOTES: INoteRecord[] = [
  { id: "note-v2-001", annotation_id: "ann-v2-001", content_md: "Check this car — front bumper unclear", resolved: false },
  { id: "note-v2-002", annotation_id: "ann-v2-002", content_md: "Bus has a logo on the side", resolved: false },
];

// ---------------------------------------------------------------------------
// Adapter: command driver → ICommandDriverV2
// ---------------------------------------------------------------------------
class CommandDriverAdapter implements ICommandDriverV2 {
  constructor(private mgr: CommandManagerV2) {}

  register(
    name: string,
    modes: string[],
    shortcut: IShortcut | null,
    shortDescription: string | null,
    longDescription: string | null,
    callback: () => ICommandAction,
    group?: string,
  ): void {
    this.mgr.register(name, modes, shortcut, shortDescription, longDescription, callback, group);
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

  getAllCommands(): Map<string, ICommandDescriptor[]> {
    return this.mgr.getAllCommands();
  }

  resolveKeyEvent(event: KeyboardEvent, mode: string): boolean {
    return this.mgr.resolveKeyEvent(event, mode);
  }

  getKeyMapForMode(mode: string): Record<string, string> {
    return this.mgr.getKeyMapForMode(mode);
  }

  getShortcutReferences(): Record<
    string,
    { label: string; description: string; keyCombinations: string[] }
  > {
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
}

// ---------------------------------------------------------------------------
// Adapter: annotations
// ---------------------------------------------------------------------------
type Annot = IAnnotationRecord<IVideoAnnotationShape, IVideoAnnotationValue>;

class AnnotationsDriverAdapter implements IAnnotationsDriverV2<IVideoAnnotationShape, IVideoAnnotationValue> {
  constructor(private store: InMemoryStore<Annot>) {}

  registerField(name: string, fn: (ann: Annot) => unknown): void {
    this.store.registerField(name, fn);
  }

  async fetch(filter?: IFilter): Promise<Annot[]> {
    return this.store.fetch(filter);
  }

  async update(id: string, data: Partial<Annot>): Promise<void> {
    return this.store.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.store.delete(id);
  }

  async create(data: Annot): Promise<Annot> {
    return this.store.create(data);
  }
}

// ---------------------------------------------------------------------------
// Adapter: notes
// ---------------------------------------------------------------------------
class NotesDriverAdapter implements INotesDriverV2 {
  constructor(private store: InMemoryStore<INoteRecord>) {}

  registerField(name: string, fn: (note: INoteRecord) => unknown): void {
    this.store.registerField(name, fn);
  }

  async fetch(filter?: IFilter): Promise<INoteRecord[]> {
    return this.store.fetch(filter);
  }

  async update(id: string, data: Partial<INoteRecord>): Promise<void> {
    return this.store.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.store.delete(id);
  }

  async create(data: INoteRecord): Promise<INoteRecord> {
    return this.store.create(data);
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
          visibility: true,
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
    "idah-video:polygon": {
      values: [
        { id: "road-sign", color: "#FFD600", label: "Road Sign", text_color: "#000000", description: "A road sign" },
        { id: "traffic-light", color: "#FF6D00", label: "Traffic Light", text_color: "#FFFFFF", description: "A traffic light" },
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
  readonly annotations: IAnnotationsDriverV2<IVideoAnnotationShape, IVideoAnnotationValue>;
  readonly notes: INotesDriverV2;

  // ── Activity context (mutable) ────────────────────────────────────────

  private _id = "mock-entry-v2-001";
  private _media: IMediaInfo = {
    id: "mock-entry-v2-001",
    meta: { duration: 100, fps: 25, width: 1920, height: 1080 },
  };
  private _status = "annotation";
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

  get status(): string {
    return this._status;
  }

  get mode(): string {
    return this._mode;
  }

  get config(): IConfig {
    return this._config;
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
    return this.commandMgr.resolveKeyEvent(event, this._mode);
  }
}
