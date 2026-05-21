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
  IAnnotationRecord,
  INoteRecord,
  IFilter,
  ICommandAction,
  ICommandDescriptor,
  IModeEvent,
  ISyncEvent,
  ISyncErrorEvent,
  IShortcut,
  ICommandStackEntry,
  IToolbarItem,
  ToolbarItemOptions,
  Unsubscribe,
} from "$idah/v2/types";
import type { IVideoAnnotationShape, IVideoAnnotationValue, IVideoFrameSelection } from "$lib/types";

import { InMemoryStore } from "./in-memory-store";
import { CommandManagerV2 } from "./command-manager";
import { ToolbarManagerV2 } from "./toolbar-manager";
import { AstProcessor } from "./ast-evaluator";
import { modKey } from "$lib/utils/browser";
import { uuidv7 } from "uuidv7";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
type SampleAnnotation = IAnnotationRecord<IVideoAnnotationShape, IVideoAnnotationValue>;

const SAMPLE_ANNOTATIONS: SampleAnnotation[] = [
  {
    id: uuidv7(),
    shape: {
      type: "idah-video:bounding-box",
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
    value: { category: "vehicles/car", label: "car" },
  },
  {
    id: uuidv7(),
    shape: {
      type: "idah-video:bounding-box",
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
    value: { category: "vehicles/bus", label: "bus" },
  },
  {
    id: uuidv7(),
    shape: {
      type: "idah-video:polygon",
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

  constructor(private mgr: CommandManagerV2) { }

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
  constructor(private mgr: ToolbarManagerV2) { }

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
  constructor(private store: InMemoryStore<Annot>) { }

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
  constructor(private store: InMemoryStore<INoteRecord>) { }

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
          visibility: [
            "in",
            [["get", ["category"]], ["vehicles/car", "vehicles/bus", "vehicles/van", "vehicles/truck"]],
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
                  opacity: 0
                }
              },
              {
                id: "partially_occluded",
                label: "Partially Occluded",
                styles: {
                  border: "dashed",
                  opacity: 4
                }
              },
              {
                id: "semi_occluded",
                label: "Semi Occluded",
                styles: {
                  border: "dotted",
                  opacity: 1
                }
              },
              {
                id: "not_occluded",
                label: "Not Occluded",
                styles: {}
              }
            ]
          },
          required: false,
          visibility: true,
          description: ""
        }
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
    resource: "mock-entry-v2-001",
    key: "",
    mime_type: "video/mp4",
    filename: "sample.mp4",
    url: "/medias/master.m3u8",
    meta: { duration: 60, fps: 30, width: 1920, height: 1080 },
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
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
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
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
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
      modes: ["default", "review", "idah-video:bounding-box", "idah-video:polygon", "note"],
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

  getFilteredConfig(shapeType: string, value: Record<string, unknown>): IShapeConfig | undefined {
    const raw = this._config[shapeType];
    if (!raw) return undefined;
    const ast = new AstProcessor(new Map(this.#objectVariables(value)));
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
