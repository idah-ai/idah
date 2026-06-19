// ---------------------------------------------------------------------------
// IdahDriverV2 — Core app adapter
// ---------------------------------------------------------------------------
import type {
  IAnnotationsDriverV2,
  ICommandDriverV2,
  IConfig,
  IDatasetInfo,
  IIdahDriverV2,
  IMediaInfo,
  IToolbarDriverV2,
  IStatsDriverV2,
  IModeEvent,
  INotesDriverV2,
  IProjectInfo,
  IShapeConfig,
  ISyncErrorEvent,
  ISyncEvent,
  Unsubscribe,
} from "../types";

import { AstProcessor } from "../utils/ast-evaluator";
import { modKey } from "../utils/browser";
import { IdbBackedAnnotationsDriverAdapter } from "./adapter/idb-driver";
import registerCommands from "./command";
import { CommandManagerV2 } from "./manager/command-manager";
import { ToolbarManagerV2 } from "./manager/toolbar-manager";

import type { RecordResponse } from "@/data/model/types";

// ── Constants ────────────────────────────────────────────────────────────

const PLUGIN_ID = "idah-video"; // TODO: make this dynamic from the route param

// ---------------------------------------------------------------------------
// Main IdahDriverV2 — Core App Adapter
// ---------------------------------------------------------------------------
export class IdahDriverV2 implements IIdahDriverV2 {
  private readonly commandMgr = new CommandManagerV2();
  private readonly toolbarMgr = new ToolbarManagerV2();
  private readonly rpc = new JsonRpcDatasource(`${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/annotations/_rpc`);

  private pendingCount = 0;

  // ── Adapters exposed to the user ──────────────────────────────────────

  readonly command: ICommandDriverV2;
  readonly toolbar: IToolbarDriverV2;
  readonly annotations: IAnnotationsDriverV2;
  readonly notes: INotesDriverV2;
  readonly stats: IStatsDriverV2;

  // ── Activity context ──────────────────────────────────────────────────

  private _id: string;
  private _dataset: IDatasetInfo;
  private _project: IProjectInfo;
  private _media: IMediaInfo;
  private _config: IConfig;
  private _workflowStep: string;
  private _mode = "editor";
  private _ready = false;

  // ── Callback stores ───────────────────────────────────────────────────

  private readyCallbacks: Set<() => void> = new Set();
  private modeChangeListeners: Set<(event: IModeEvent) => void> = new Set();
  private syncChangeListeners: Set<(event: ISyncEvent) => void> = new Set();
  private syncErrorListeners: Set<(event: ISyncErrorEvent) => void> = new Set();

  // ── Internal references (have cache/clearCache) ──────────────────────
  private idbAnnotationsDriver: (IAnnotationsDriverV2 & { clearCache(): Promise<void> }) | null = null;
  #notesAdapter: NotesDriverAdapter | null = null;

  constructor(opts: {
    id: string;
    dataset: IDatasetInfo;
    project: IProjectInfo;
    media: IMediaInfo;
    config: IConfig;
    workflowStep: string;
  }) {
    this._id = opts.id;
    this._dataset = opts.dataset;
    this._project = opts.project;
    this._media = opts.media;
    this._config = opts.config;
    this._workflowStep = opts.workflowStep;
    this.rpc.setErrorObserver((err) => {
      this.syncErrorListeners.forEach((cb) => cb(err));
    });

    // Build command & toolbar adapters
    this.command = new CommandDriverAdapter(this.commandMgr);
    this.toolbar = new ToolbarDriverAdapter(this.toolbarMgr);

    const backendDriver = createBackendCrudDriver(this._id, this.rpc);
    const idbDriver = IdbBackedAnnotationsDriverAdapter({
      entryId: this._id,
      pluginId: PLUGIN_ID,
      backend: backendDriver,
      enqueue: (op: Promise<unknown>) => this.#enqueue(op),
    });
    this.idbAnnotationsDriver = idbDriver;
    this.annotations = idbDriver?.sealed() ?? new AnnotationsDriverAdapter(this._id, this.rpc);

    // Build notes driver with observer-based push interface
    const notesAdapter = new NotesDriverAdapter(this._id);
    this.notes = notesAdapter.sealed();
    this.#notesAdapter = notesAdapter;

    // Build stats driver — core stats from this driver + plugin-registered providers
    this.stats = new StatsDriverAdapter(this);

    // ── Register default commands ─────────────────────────────────────
    registerCommands(this);

    this.onSyncChange((syncChangeEvent) => {
      this._ready = syncChangeEvent.queued == 0;
      if (this._ready) for (const cb of this.readyCallbacks) cb();
    });

    this.onSyncError((syncErrorEvent) => {
      console.error({ syncErrorEvent });
    });

    this.onReady(() => {
      console.log("SYNC READY");
    });

    queueMicrotask(() => {
      this._ready = true;
      for (const cb of this.readyCallbacks) cb();
    });
  }

  // ── Internal — used by core commands only ──────────────────────────────

  /**
   * @internal Used by core-internal components like NoteOverlay.
   * Returns the concrete NotesDriverAdapter (not the INotesDriverV2 interface)
   * for access to core-internal methods (onNotePosition, onNoteSelection, etc.).
   */
  get notesAdapter(): NotesDriverAdapter | null {
    return this.#notesAdapter;
  }

  /**
   * @internal Used by core.reset command only.
   * Clears the IDB cache. Not on IIdahDriverV2; not reachable from the
   * sealed object returned by createIdahDriverV2.
   */
  async resetCache(): Promise<void> {
    await (this.idbAnnotationsDriver?.clearCache() ?? Promise.resolve());
  }

  /**
   * @internal Used by core.retry command only.
   * Resumes the RPC queue after a sync error.
   */
  resumeSync(): void {
    this.rpc.resume();
  }

  #enqueue(op: Promise<unknown>): void {
    this.pendingCount++;
    this.#emitSyncChange();
    op.catch(console.error).finally(() => {
      this.pendingCount--;
      this.#emitSyncChange();
    });
  }

  #emitSyncChange(): void {
    const event: ISyncEvent = { queued: this.pendingCount };
    this.syncChangeListeners.forEach((cb) => cb(event));
  }

  // ── Readonly properties ───────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get dataset(): IDatasetInfo {
    return { ...this._dataset };
  }

  get project(): IProjectInfo {
    return { ...this._project };
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
    if (this._ready) cb();
    this.readyCallbacks.add(cb);
  }

  onSyncChange(cb: (event: ISyncEvent) => void): Unsubscribe {
    this.syncChangeListeners.add(cb);
    return () => this.syncChangeListeners.delete(cb);
  }

  onSyncError(cb: (event: ISyncErrorEvent) => void): Unsubscribe {
    this.syncErrorListeners.add(cb);
    return () => this.syncErrorListeners.delete(cb);
  }

  // ── Keyboard dispatch ──────────────────────────────────────────────────

  handleKeydown(event: KeyboardEvent): boolean {
    if (modKey(event) && event.code === "Space") {
      (this.command as CommandDriverAdapter).openPalette();
      return true;
    }
    return this.command.resolveKeyEvent(event, this._mode);
  }

  // ── Private helpers ───────────────────────────────────────────────────

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

  sealed(): IIdahDriverV2 {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const driver = this;
    return {
      get id() {
        return driver.id;
      },
      get dataset() {
        return driver.dataset;
      },
      get project() {
        return driver.project;
      },
      get media() {
        return driver.media;
      },
      get workflowStep() {
        return driver.workflowStep;
      },
      get mode() {
        return driver.mode;
      },
      get config() {
        return driver.config;
      },
      get command() {
        return driver.command;
      },
      get toolbar() {
        return driver.toolbar;
      },
      get annotations() {
        return driver.annotations;
      },
      get notes() {
        return driver.notes;
      },
      get stats() {
        return driver.stats;
      },

      setMode: driver.setMode.bind(driver),
      onModeChange: driver.onModeChange.bind(driver),
      onReady: driver.onReady.bind(driver),
      onSyncChange: driver.onSyncChange.bind(driver),
      onSyncError: driver.onSyncError.bind(driver),
      getFilteredConfig: driver.getFilteredConfig.bind(driver),
      handleKeydown: driver.handleKeydown.bind(driver),
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

import { JsonRpcDatasource } from "@/data/jsonrpc";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { mediaBackendDataSource, MediaRecord } from "@/data/model/media/medias/medias-record";
import { AnnotationsDriverAdapter, createBackendCrudDriver } from "./adapter/annotationsBackendCrud";
import { CommandDriverAdapter } from "./adapter/command";
import { NotesDriverAdapter } from "./adapter/notes";
import { ToolbarDriverAdapter } from "./adapter/toolbar";
import { StatsDriverAdapter } from "./adapter/stats";

export async function createIdahDriverV2(entryId: string): Promise<IIdahDriverV2> {
  const latestEntryRes = await entriesBackendDataSource.get(entryId, {
    included: ["dataset", "dataset.project"],
    noCache: true,
  });

  const entry = latestEntryRes.data;
  const dataset = entry.dataset;

  const datasetInfo: IDatasetInfo = {
    id: dataset.id,
    name: dataset.name,
    modality: dataset.modality,
  };

  const projectInfo: IProjectInfo = {
    id: dataset.project.id,
    name: dataset.project.name,
  };

  // Get media info
  const mediaRes = (await mediaBackendDataSource.getInfo({
    resource: entry.resource,
  })) as RecordResponse<MediaRecord>;

  const m = mediaRes.data;
  const mediaInfo = {
    id: entry.id,
    resource: m.resource,
    key: m.key,
    mime_type: m.mime_type,
    filename: m.filename,
    meta: m.meta,
    url:
      // TODO: this is a hack to get the correct media URL for video vs image.
      // We should have a better way to determine the media type and URL.
      entry.dataset.modality === "idah-video"
        ? `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files/${entry.resource}/master.m3u8`
        : `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files/${entry.resource}/processed.webp`,
  };

  const driver = new IdahDriverV2({
    id: entry.id,
    dataset: datasetInfo,
    project: projectInfo,
    media: mediaInfo,
    config: dataset.labeling_configuration as IConfig,
    workflowStep: entry.wf_step,
  });

  return driver;
}
