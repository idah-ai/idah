// ---------------------------------------------------------------------------
// V2 IdahDriver — the main in-memory mock driver hub
// ---------------------------------------------------------------------------
import type {
  IAnnotationRecord,
  IAnnotationsDriverV2,
  ICommandAction,
  ICommandDescriptor,
  ICommandDriverV2,
  ICommandStackEntry,
  IConfig,
  IFilter,
  IIdahDriverV2,
  IMediaInfo,
  IModeEvent,
  INoteRecord,
  INotesDriverV2,
  IShapeConfig,
  IShortcut,
  ISyncErrorEvent,
  ISyncEvent,
  IToolbarDriverV2,
  ToolbarItemOptions,
  Unsubscribe,
} from "$idah/v2/types";
import type { IImageAnnotationShape, IImageAnnotationValue } from "$lib/types";

import { modKey } from "$lib/utils/browser";
import { uuidv7 } from "uuidv7";
import { AstProcessor } from "./ast-evaluator";
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
    shape: {
      end: 0,
      type: "idah-image:bounding-box",
      start: 0,
      frames: [
        {
          angle: 0,
          frame: 0,
          points: [
            [0.030237486417802006, 0.2333274536145938],
            [0.03965013702021159, 0.2333274536145938],
            [0.03965013702021159, 0.24533327001214162],
            [0.030237486417802006, 0.24533327001214162],
          ],
        },
      ],
    } as IImageAnnotationShape,
    value: { category: "vehicles/car", label: "car" },
  },
  {
    id: uuidv7(),
    shape: {
      end: 0,
      type: "idah-image:polygon",
      start: 0,
      frames: [
        {
          frame: 0,
          points: [
            [0.39446366782006914, 0.6193771626297577],
            [0.3391003460207612, 0.6159169550173011],
            [0.3241061130334486, 0.7197231833910035],
            [0.38638985005767007, 0.7283737024221454],
            [0.4025374855824682, 0.6972318339100346],
          ],
        },
      ],
    } as IImageAnnotationShape,
    value: { category: "pedestrian", label: "pedestrian" },
  },
];

const SAMPLE_NOTES: INoteRecord[] = [
  {
    id: "note-v2-001",
    annotation_id: "ann-v2-001",
    content_md: "Check this car — front bumper unclear",
    resolved: false,
  },
  { id: "note-v2-002", annotation_id: "ann-v2-002", content_md: "Bus has a logo on the side", resolved: false },
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
}

// ---------------------------------------------------------------------------
// Adapter: annotations
// ---------------------------------------------------------------------------
type Annot = IAnnotationRecord<IImageAnnotationShape, IImageAnnotationValue>;

class AnnotationsDriverAdapter implements IAnnotationsDriverV2<IImageAnnotationShape, IImageAnnotationValue> {
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
export class IdahDriverV2 implements IIdahDriverV2<IImageAnnotationShape, IImageAnnotationValue> {
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
    "idah-image:bounding-box": {
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
            [["get", ["annotation.category"]], [["vehicles/car", "vehicles/bus", "vehicles/van", "vehicles/truck"]]],
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

    // ── Register default idah commands ────────────────────────────────

    const cmdMgr = this.commandMgr;
    const driver = this;

    this.command.register({
      name: "core.undo",
      group: "General",
      modes: ["default", "review", "idah-image:bounding-box", "idah-image:polygon", "note"],
      shortcut: "Control+Z",
      shortDescription: "Undo",
      longDescription: "Undo the last action",
      callback: () => ({
        command: {
          name: "core.undo",
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
      name: "core.redo",
      group: "General",
      modes: ["default", "review", "idah-image:bounding-box", "idah-image:polygon", "note"],
      shortcut: "Control+Shift+Z",
      shortDescription: "Redo",
      longDescription: "Redo the last undone action",
      callback: () => ({
        command: {
          name: "core.redo",
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
      name: "core.exit_mode",
      group: "General",
      modes: ["default", "review", "idah-image:bounding-box", "idah-image:polygon", "note"],
      shortcut: "Escape",
      shortDescription: "Exit current mode",
      longDescription: "Return to the default selection mode",
      callback: () => ({
        command: {
          name: "core.exit_mode",
          group: "General",
          modes: [],
          shortcut: null,
          shortDescription: null,
          longDescription: null,
        },
        do() {
          driver.setMode("default");
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

  get mode(): string {
    return this._mode;
  }

  get config(): IConfig {
    return this._config;
  }

  getFilteredConfig(
    shapeType: string,
    value: Record<string, unknown>,
    objectName: string = "annotation",
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
