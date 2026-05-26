// ---------------------------------------------------------------------------
// IdahDriverV2 — Core app adapter
//
// Bridges the V2 IIdahDriverV2 interface with the actual backend data
// sources using the IndexedDB-backed annotations driver for offline-first
// annotation caching.
//
// The annotations sub-module uses createIndexedDbAnnotationsDriver with a
// BackendCrudDriver that talks to the real JSON:API / JSON-RPC endpoints.
// Notes use the BackendDataSource directly (no IDB layer yet).
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
  /** Command manager (exposed for direct access). */
  readonly commandMgr = new CommandManagerV2();

  /** Toolbar manager (exposed for direct access). */
  readonly toolbarMgr = new ToolbarManagerV2();

  /** Sync queue for IDB background operations. */
  readonly syncQueueMgr = new SyncQueueManager(
    (event) => {
      this.syncChangeListeners.forEach((cb) => cb(event));
    },
    (event) => {
      this.syncErrorListeners.forEach((cb) => cb(event));
    },
  );

  // ── Adapters exposed to the user ──────────────────────────────────────

  readonly command: ICommandDriverV2;
  readonly toolbar: IToolbarDriverV2;
  readonly annotations: IAnnotationsDriverV2;
  readonly notes: INotesDriverV2;

  // ── Activity context (set via constructor) ────────────────────────────

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

  constructor(opts: { id: string; media: IMediaInfo; config: IConfig; workflowStep: string }) {
    this._id = opts.id;
    this._media = opts.media;
    this._config = opts.config;
    this._workflowStep = opts.workflowStep;

    // Build command & toolbar adapters
    this.command = new CommandDriverAdapter(this.commandMgr);
    this.toolbar = new ToolbarDriverAdapter(this.toolbarMgr);

    // Build the IDB-backed annotations driver or fall back to AnnotationsDriver
    const idbDriver = IdbBackedAnnotationsDriverAdapter({
      entryId: this._id,
      pluginId: PLUGIN_ID,
      backend: createBackendCrudDriver(this._id),
      enqueue: (op: Promise<unknown>) => this.syncQueueMgr.enqueue(op),
    });
    this.annotations = idbDriver ?? new AnnotationsDriverAdapter(this._id);
    // Build notes driver (no IDB layer yet)
    this.notes = new NotesDriverAdapter();

    // ── Register default idah commands ────────────────────────────────
    registerCommands(this);

    this.onSyncChange((syncChangeEvent) => {
      console.warn({ syncChangeEvent });
      this._ready = syncChangeEvent.queued == 0;
      if (this._ready) for (const cb of this.readyCallbacks) cb();
    });

    this.onSyncError((syncErrorEvent) => {
      console.error({ syncErrorEvent });
    });

    this.onReady(() => {
      console.warn("SYNC READY");
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

  // ── Keyboard dispatch ──────────────────────────────────────────────────

  handleKeydown(event: KeyboardEvent): boolean {
    // Ctrl/Cmd+Space → toggle command palette (handled here, not via command)
    if (modKey(event) && event.code === "Space") {
      (this.command as CommandDriverAdapter).openPalette();
      return true;
    }
    return this.commandMgr.resolveKeyEvent(event, this._mode);
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

// ── Factory ──────────────────────────────────────────────────────────────

/**
 * Create an IdahDriverV2 from an entry record and its dataset.
 * This is the main factory used by the plugin page.
 */
import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import { mediaBackendDataSource, MediaRecord } from "@/data/model/media/medias/medias-record";
import { CommandDriverAdapter } from "./adapter/command";
import { AnnotationsDriverAdapter, createBackendCrudDriver } from "./adapter/annotationsBackendCrud";
import { NotesDriverAdapter } from "./adapter/notes";
import { ToolbarDriverAdapter } from "./adapter/toolbar";
import { SyncQueueManager } from "./manager/syncQueueManager";

export async function createIdahDriverV2(entryId: string): Promise<IdahDriverV2> {
  // Start workflow if needed
  const checkEntryRes = await entriesBackendDataSource.get(entryId, {
    fields: {
      [EntryRecord.type]: ["wf_step"],
    },
    noCache: true,
  });

  if (checkEntryRes.data.wf_step === "start") {
    await entriesBackendDataSource.submit(entryId);
  }

  // Get the latest entry record with dataset
  const latestEntryRes = await entriesBackendDataSource.get(entryId, {
    included: ["dataset", "dataset.project"],
    noCache: true,
  });

  const entry = latestEntryRes.data;
  const dataset = entry.dataset;

  // Get media info
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
    // Fallback if media info is not available
    // todo throw accordingly
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

  return new IdahDriverV2({
    id: entry.id,
    media: mediaInfo,
    config: dataset.labeling_configuration as IConfig,
    workflowStep: entry.wf_step,
  });
}
