// ---------------------------------------------------------------------------
// IdahDriverV2 — Core app adapter
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
  IModeEvent,
  ISyncEvent,
  ISyncErrorEvent,
  Unsubscribe,
} from "../types";

import { CommandManagerV2 } from "./manager/command-manager";
import { ToolbarManagerV2 } from "./manager/toolbar-manager";
import { AstProcessor } from "../utils/ast-evaluator";
import { modKey } from "../utils/browser";
import { IdbBackedAnnotationsDriverAdapter } from "./adapter/idb-driver";
import registerCommands from "./command";

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

  // ── Activity context ──────────────────────────────────────────────────

  private _id: string;
  private _media: IMediaInfo;
  private _config: IConfig;
  private _workflowStep: string;
  private _mode = "default";
  private _ready = false;

  // ── Callback stores ───────────────────────────────────────────────────

  private readyCallbacks: Set<() => void> = new Set();
  private modeChangeListeners: Set<(event: IModeEvent) => void> = new Set();
  private syncChangeListeners: Set<(event: ISyncEvent) => void> = new Set();
  private syncErrorListeners: Set<(event: ISyncErrorEvent) => void> = new Set();

  // ── Internal IDB driver reference (has clearCache) ────────────────────
  private idbAnnotationsDriver: (IAnnotationsDriverV2 & { clearCache(): Promise<void> }) | null = null;

  constructor(opts: { id: string; media: IMediaInfo; config: IConfig; workflowStep: string }) {
    this._id = opts.id;
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

    // Build notes driver (no IDB layer yet)
    this.notes = new NotesDriverAdapter();

    // ── Register default commands ─────────────────────────────────────
    registerCommands(this);

    this.onSyncChange((syncChangeEvent) => {
      console.log({ syncChangeEvent });
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

import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import { mediaBackendDataSource, MediaRecord } from "@/data/model/media/medias/medias-record";
import { JsonRpcDatasource } from "@/data/jsonrpc";
import { CommandDriverAdapter } from "./adapter/command";
import { AnnotationsDriverAdapter, createBackendCrudDriver } from "./adapter/annotationsBackendCrud";
import { NotesDriverAdapter } from "./adapter/notes";
import { ToolbarDriverAdapter } from "./adapter/toolbar";

export async function createIdahDriverV2(entryId: string): Promise<IIdahDriverV2> {
  const checkEntryRes = await entriesBackendDataSource.get(entryId, {
    fields: { [EntryRecord.type]: ["wf_step"] },
    noCache: true,
  });

  if (checkEntryRes.data.wf_step === "start") {
    await entriesBackendDataSource.submit(entryId);
  }

  const latestEntryRes = await entriesBackendDataSource.get(entryId, {
    included: ["dataset", "dataset.project"],
    noCache: true,
  });

  const entry = latestEntryRes.data;
  const dataset = entry.dataset;

  let mediaInfo: IMediaInfo;
  try {
    const mediaRes = (await mediaBackendDataSource.getInfo({
      resource: entry.resource,
    })) as RecordResponse<MediaRecord>;

    const m = mediaRes.data;
    mediaInfo = {
      id: entry.id,
      resource: m.resource,
      key: m.key,
      mime_type: m.mime_type,
      filename: m.filename,
      meta: m.meta,
      url: `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files/${entry.resource}/master.m3u8`,
    };
  } catch {
    mediaInfo = {
      id: entry.id,
      resource: entry.resource,
      key: "",
      mime_type: "",
      filename: entry.name,
      meta: {},
      url: `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/medias/files/${entry.resource}/master.m3u8`,
    };
  }

  const driver = new IdahDriverV2({
    id: entry.id,
    media: mediaInfo,
    config: dataset.labeling_configuration as IConfig,
    workflowStep: entry.wf_step,
  });

  return driver.sealed();
}
