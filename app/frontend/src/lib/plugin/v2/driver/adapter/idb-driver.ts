// ---------------------------------------------------------------------------
// idb-driver.ts
//
// IndexedDB-backed IAnnotationsDriverV2<Shape, Annotation>.
//
// Generic over <Shape, Annotation> — treats both as opaque blobs.
// No knowledge of video, image, CT, or any specific modality.
//
// IdbBackedAnnotationsDriverAdapter is synchronous — IDB is opened lazily on
// the first fetch / create / update / delete call.
//
// Takes a plain `enqueue` function for remote driver sync operations.
// The queue implementation is the caller's concern.
// ---------------------------------------------------------------------------

import type { ListOptions } from "@/data/DataSource";
import type {
  IAnnotationsDriverV2,
  IAnnotationRecord,
  IChangesQuery,
  IChangesResult,
  IFilter,
  IFilterValue,
  IRangeOp,
} from "../../types";
import { uuidv7 } from "uuidv7";
import { createChangesAdapter, type ChangesAdapter } from "./changes";

// ─── Schema version ───────────────────────────────────────────────────────────

const VERSION = 3;

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_PAGE_SIZE = 100;
const EXPIRATION_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

// ─── ICrudDriver ──────────────────────────────────────────────────────────────

/**
 * Minimal backend transport interface used exclusively by the IDB sync loop.
 * Intentionally separate from IAnnotationsDriverV2 — pagination and filter
 * serialisation are transport concerns, not consumer-facing API concerns.
 */
export interface ICrudDriver<T extends { id: string }> {
  list(params: ListOptions): Promise<{ data: T[] }>;
  create(record: T): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  setShape(annotationId: string, key: string, value: object | null): Promise<void>;
  setShapes(annotationId: string, entries: Array<{ key: string; value: object | null }>): Promise<void>;
}

// ─── Minimal IDB helpers ──────────────────────────────────────────────────────

const IDB_STORES = [
  {
    name: "annotations",
    options: { keyPath: ["entryId", "id"] } as IDBObjectStoreParameters,
    indexes: [{ name: "entryId", keyPath: "entryId" }],
  },
  {
    name: "entries",
    options: { keyPath: "entryId" } as IDBObjectStoreParameters,
    indexes: [{ name: "lastVisitedAt", keyPath: "lastVisitedAt" }],
  },
];

const openIdb = (pluginId: string, onReloadRequired: () => void): Promise<IDBDatabase> => {
  const name = `idahPlugin::${pluginId}`;
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onerror = (e) => reject(e);
    req.onblocked = () => {
      // A tab still running an older version holds the database open and blocks
      // this upgrade. Tell the user to close the other tabs so the new tab can
      // resync; without this the new tab would wait forever. The reload is left
      // to the caller so it can wait for queued backend writes to drain.
      console.warn(`[idb-driver] "${name}" upgrade blocked by another tab.`);
      onReloadRequired();
    };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const s of IDB_STORES) {
        if (!db.objectStoreNames.contains(s.name)) {
          const os = db.createObjectStore(s.name, s.options);
          for (const idx of s.indexes) os.createIndex(idx.name, idx.keyPath);
        }
      }
      // Version 2: the stored annotation record shape changed (shape_type/
      // shape_args/category/properties + soft-delete fields). Clear the
      // annotations store and reset lastUpdatedAt so the sync loop performs a
      // full resync rather than trying to migrate per-record.
      if (e.oldVersion < 2) {
        if (db.objectStoreNames.contains("annotations")) {
          db.deleteObjectStore("annotations");
          const os = db.createObjectStore("annotations", { keyPath: ["entryId", "id"] } as IDBObjectStoreParameters);
          os.createIndex("entryId", "entryId");
        }
        if (db.objectStoreNames.contains("entries")) {
          db.deleteObjectStore("entries");
          const os = db.createObjectStore("entries", { keyPath: "entryId" } as IDBObjectStoreParameters);
          os.createIndex("lastVisitedAt", "lastVisitedAt");
        }
      }
      // Version 3 keeps tombstones in the cache (soft-deleted annotations stay
      // visible to the History panel and note markers), but older caches threw
      // them away. Clear both stores through the upgrade transaction and reset
      // lastUpdatedAt so the sync loop performs a full resync and re-downloads
      // the deleted records.
      if (e.oldVersion < 3) {
        clearStoresThroughUpgrade(db);
      }
    };
    // Close the database when another tab upgrades it, so this tab does not
    // block the upgrade. The caller reloads to pick up the new schema, waiting
    // for queued backend writes to drain first.
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      db.onversionchange = () => {
        db.close();
        onReloadRequired();
      };
      resolve(db);
    };
  });
};

/** Delete and recreate the two stores inside an upgrade transaction. */
function clearStoresThroughUpgrade(db: IDBDatabase): void {
  for (const name of ["annotations", "entries"]) {
    if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
  }
  for (const s of IDB_STORES) {
    const os = db.createObjectStore(s.name, s.options);
    for (const idx of s.indexes) os.createIndex(idx.name, idx.keyPath);
  }
}

const idbFetch = <T extends { id: string }>(
  db: IDBDatabase,
  entryId: string,
  virtualFields?: Map<string, (ann: T) => unknown>,
  filter?: IFilter,
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const results: T[] = [];
    const range = IDBKeyRange.only(entryId);
    const req = db
      .transaction(["annotations"], "readonly")
      .objectStore("annotations")
      .index("entryId")
      .openCursor(range);
    req.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!c) {
        resolve(results);
        return;
      }
      const rec = c.value;
      const isTombstone = !!rec.deleted_at;

      const deletedMode = filter?.deleted;
      if (deletedMode === "true" && !isTombstone) {
        c.continue();
        return;
      }
      if (deletedMode !== "true" && deletedMode !== "all" && isTombstone) {
        c.continue();
        return;
      }

      let matches = true;
      if (filter) {
        for (const [field, expected] of Object.entries(filter)) {
          if (field === "deleted") continue;
          const val =
            virtualFields && virtualFields.has(field) ? virtualFields.get(field)!(rec) : resolvePath(rec, field);
          if (!matchesFilter(val, expected)) {
            matches = false;
            break;
          }
        }
      }
      if (matches) results.push({ ...rec });
      c.continue();
    };
    req.onerror = reject;
  });

const idbGet = <T extends { id: string }>(db: IDBDatabase, entryId: string, id: string): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["annotations"], "readonly").objectStore("annotations").get([entryId, id]);
    req.onsuccess = (e) => resolve((e.target as IDBRequest<T | undefined>).result);
    req.onerror = reject;
  });

const idbUpsertBatch = <T extends { id: string }>(db: IDBDatabase, entryId: string, records: T[]): Promise<void> => {
  if (!records.length) return Promise.resolve();
  const tx = db.transaction(["annotations"], "readwrite");
  const os = tx.objectStore("annotations");
  for (const r of records) os.put({ ...r, entryId });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
};

const idbCreate = <T extends { id: string }>(db: IDBDatabase, entryId: string, record: T): Promise<T> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(["annotations"], "readwrite");
    const os = tx.objectStore("annotations");
    const getReq = os.get([entryId, record.id]);
    getReq.onsuccess = () => {
      if (getReq.result) {
        // A create over an existing id is a bug (callers only pass fresh ids,
        // and add/split/paste call restore on redo). Name the tombstone so the
        // error is actionable instead of a bare ConstraintError.
        reject(new Error(`Cannot create annotation: id ${record.id} already exists (it may be a deleted annotation)`));
        return;
      }
      const addReq = os.add({ ...record, entryId });
      addReq.onsuccess = () => resolve(record);
      addReq.onerror = () => reject(addReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });

const idbGetLastUpdated = (db: IDBDatabase, entryId: string): Promise<Date> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["entries"], "readonly").objectStore("entries").get(entryId);
    req.onsuccess = (e) => resolve(new Date((e.target as IDBRequest).result?.lastUpdatedAt ?? 0));
    req.onerror = reject;
  });

const idbSetLastUpdated = (db: IDBDatabase, entryId: string, timestamp: Date): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = db
      .transaction(["entries"], "readwrite")
      .objectStore("entries")
      .put({ entryId, lastUpdatedAt: timestamp, lastVisitedAt: timestamp });
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });

const idbMarkVisited = (db: IDBDatabase, entryId: string, timestamp: Date): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    const req = store.get(entryId);
    req.onsuccess = (e) => {
      const existing = (e.target as IDBRequest).result ?? { entryId, lastUpdatedAt: 0 };
      store.put({ ...existing, entryId, lastVisitedAt: timestamp });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

const idbGetStaleEntryIds = (db: IDBDatabase, cutoff: Date): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const stale: string[] = [];
    const range = IDBKeyRange.upperBound(cutoff);
    const req = db.transaction(["entries"], "readonly").objectStore("entries").index("lastVisitedAt").openCursor(range);
    req.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!c) {
        resolve(stale);
        return;
      }
      stale.push(c.value.entryId);
      c.continue();
    };
    req.onerror = reject;
  });

const idbPurgeEntry = (db: IDBDatabase, entryId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(["annotations", "entries"], "readwrite");
    const annoStore = tx.objectStore("annotations");
    const range = IDBKeyRange.only(entryId);
    const req = annoStore.index("entryId").openCursor(range);
    req.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!c) {
        tx.objectStore("entries").delete(entryId);
        return;
      }
      c.delete();
      c.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });

// ─── Filter engine ────────────────────────────────────────────────────────────

const resolvePath = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, k) => (acc != null ? (acc as Record<string, unknown>)[k] : undefined), obj);

function matchesFilter(fieldValue: unknown, filterValue: IFilterValue): boolean {
  if (typeof filterValue === "string" || typeof filterValue === "number") {
    return fieldValue === filterValue;
  }
  if (typeof filterValue === "object" && !Array.isArray(filterValue)) {
    const op = filterValue as IRangeOp;
    if (op.eq !== undefined) return fieldValue === op.eq;
    if (op.neq !== undefined) return fieldValue !== op.neq;
    const num = Number(fieldValue);
    if (isNaN(num)) return false;
    if (op.gte !== undefined && num < Number(op.gte)) return false;
    if (op.gt !== undefined && num <= Number(op.gt)) return false;
    if (op.lte !== undefined && num > Number(op.lte)) return false;
    if (op.lt !== undefined && num >= Number(op.lt)) return false;
    return true;
  }
  if (Array.isArray(filterValue)) {
    return fieldValue !== undefined && (filterValue as unknown[]).includes(fieldValue);
  }
  return true;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface IndexedDbAnnotationsDriverConfig<
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
> {
  entryId: string;
  pluginId: string;
  backend: ICrudDriver<IAnnotationRecord<Shape, Annotation>>;
  enqueue: (p: Promise<unknown>) => void;
  changes?: ChangesAdapter;
  /**
   * Invoked when the local cache must be reloaded because another tab upgraded
   * the database (or blocked this tab's upgrade). The driver closes the DB and
   * defers the reload to the caller, so queued backend writes are not lost.
   */
  onReloadRequired?: () => void;
}

// ─── Internal type ────────────────────────────────────────────────────────────

/** Full driver surface including the clearCache escape hatch (private to the module). */
type IdbDriverInternal<Shape, Annotation> = IAnnotationsDriverV2<Shape, Annotation> & {
  clearCache(): Promise<void>;
  sealed(): IAnnotationsDriverV2<Shape, Annotation>;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export const IdbBackedAnnotationsDriverAdapter = <
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
>(
  config: IndexedDbAnnotationsDriverConfig<Shape, Annotation>,
): IdbDriverInternal<Shape, Annotation> | null => {
  if (typeof indexedDB === "undefined") {
    console.warn("[idb-driver] IndexedDB unavailable (SSR mode).");
    return null;
  }

  const { entryId, backend, enqueue } = config;

  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => {
    if (!dbPromise) dbPromise = openIdb(config.pluginId, () => config.onReloadRequired?.());
    return dbPromise;
  };

  const virtualFields = new Map<string, (ann: IAnnotationRecord<Shape, Annotation>) => unknown>();

  const changesAdapter = config.changes ?? createChangesAdapter(entryId);

  let syncPromise: Promise<void> | null = null;
  let purgeScheduled = false;
  let visitMarked = false;

  // Run the initial sync loop exactly once, sharing the same promise across
  // concurrent fetch() calls so the backend is not listed twice when they
  // overlap. On failure the promise is cleared so a later fetch() can retry.
  const syncOnce = async (db: IDBDatabase) => {
    if (!syncPromise) {
      syncPromise = (async () => {
        const lastUpdated = await idbGetLastUpdated(db, entryId);
        let currentLastUpdatedAt = lastUpdated;
        let page = 1,
          hasMore = true;
        while (hasMore) {
          const response = await backend.list({
            filters: { entry_id: entryId, updated_at__gt: lastUpdated.toISOString() },
            // verse-sequel applies only the last sort key (see
            // AnnotationChange::Service::DEFAULT_SORT), so this listing is
            // ordered by `id` alone. That is still a stable order for offset
            // paging.
            sort: ["updated_at", "id"],
            pagination: {
              page,
              itemsPerPage: SYNC_PAGE_SIZE,
            },
          });
          response.data.forEach((a) => {
            const updatedAt = new Date(a.updated_at || 0);
            if (updatedAt > currentLastUpdatedAt) currentLastUpdatedAt = updatedAt;
          });
          // Upsert every record we receive, deleted or not, so tombstones stay
          // in the cache (the History panel and note markers read them). The
          // backend returns deleted records by default, so this adds no extra
          // network traffic.
          await idbUpsertBatch(db, entryId, response.data);
          hasMore = response.data.length === SYNC_PAGE_SIZE;
          page++;
        }
        await idbSetLastUpdated(db, entryId, currentLastUpdatedAt);
      })().catch((err) => {
        // A failed sync must be retryable by a later fetch().
        syncPromise = null;
        throw err;
      });
    }
    await syncPromise;
  };

  return {
    registerField(name, fn) {
      virtualFields.set(name, fn as (ann: IAnnotationRecord<Shape, Annotation>) => unknown);
    },

    sealed() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const driver = this;
      return {
        registerField: driver.registerField.bind(driver),
        fetch: driver.fetch.bind(driver),
        create: driver.create.bind(driver),
        update: driver.update.bind(driver),
        delete: driver.delete.bind(driver),
        restore: driver.restore.bind(driver),
        setShape: driver.setShape.bind(driver),
        setShapes: driver.setShapes.bind(driver),
        changes: driver.changes.bind(driver),
        version: driver.version.bind(driver),
      };
    },

    async clearCache() {
      const db = await getDb();
      await idbPurgeEntry(db, entryId);
    },

    async fetch(filter?: IFilter): Promise<IAnnotationRecord<Shape, Annotation>[]> {
      const db = await getDb();

      if (!visitMarked) {
        visitMarked = true;
        await idbMarkVisited(db, entryId, new Date(Date.now()));
      }

      if (!purgeScheduled) {
        purgeScheduled = true;
        const cutoff = new Date(Date.now() - EXPIRATION_PERIOD_MS);
        try {
          const staleIds = await idbGetStaleEntryIds(db, cutoff);
          for (const staleId of staleIds) await idbPurgeEntry(db, staleId);
        } catch (err) {
          console.error("Error purging stale entry", err);
          purgeScheduled = false;
        }
      }

      await syncOnce(db);

      return await idbFetch<IAnnotationRecord<Shape, Annotation>>(db, entryId, virtualFields, filter);
    },

    async update(id, data): Promise<void> {
      const db = await getDb();
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, id);
      if (!existing) throw new Error(`Annotation not found: ${id}`);
      if (existing.deleted_at) throw new Error(`Cannot write to a deleted annotation: ${id}`);
      await idbUpsertBatch(db, entryId, [{ ...existing, ...data }]);
      enqueue(backend.update(id, data));
    },

    async delete(id): Promise<void> {
      const db = await getDb();
      // Write a tombstone locally instead of removing the record, so the
      // History panel and note markers can still read the deleted annotation.
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, id);
      if (existing) {
        await idbUpsertBatch(db, entryId, [
          { ...existing, deleted_at: new Date(), deleted_by_id: existing.deleted_by_id ?? null },
        ]);
      }
      enqueue(backend.delete(id));
    },

    async restore(id: string): Promise<void> {
      const db = await getDb();
      // Local-first: clear the tombstone immediately so undo does not hang
      // offline. The backend restore is enqueued like every other write; see
      // the IAnnotationsDriverV2.restore contract.
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, id);
      if (existing) {
        await idbUpsertBatch(db, entryId, [{ ...existing, deleted_at: null, deleted_by_id: null }]);
      }
      enqueue(backend.restore(id));
    },

    async create(data): Promise<IAnnotationRecord<Shape, Annotation>> {
      const db = await getDb();
      const record = { ...data, id: data.id ?? uuidv7() } as IAnnotationRecord<Shape, Annotation>;
      await idbCreate(db, entryId, record);
      enqueue(backend.create(record));
      return record;
    },

    async setShape(annotationId: string, key: string, value: object | null): Promise<void> {
      // Store tiles directly in the annotation's shape field in the main
      // annotations store (not in a separate annotation_shapes store).
      // This mirrors how the backend returns annotations with tiles merged
      // into `dimensions`, and how data.svelte.ts manages the in-memory
      // shape. No separate merge step needed.
      const db = await getDb();
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, annotationId);
      if (existing?.deleted_at) throw new Error(`Cannot write shape to a deleted annotation: ${annotationId}`);
      const tx = db.transaction(["annotations"], "readwrite");
      const store = tx.objectStore("annotations");

      const getReq = store.get([entryId, annotationId]);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          const shape = { ...(record.shape_args as Record<string, unknown>) };
          if (value === null) {
            delete shape[key];
          } else {
            shape[key] = value;
          }
          store.put({ ...record, entryId, shape_args: shape, updated_at: new Date().toISOString() });
        }
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
      });

      // Enqueue the backend sync
      enqueue(backend.setShape(annotationId, key, value));
    },

    async setShapes(annotationId: string, entries: Array<{ key: string; value: object | null }>): Promise<void> {
      if (entries.length === 0) return;
      const db = await getDb();
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, annotationId);
      if (existing?.deleted_at) throw new Error(`Cannot write shape to a deleted annotation: ${annotationId}`);
      const tx = db.transaction(["annotations"], "readwrite");
      const store = tx.objectStore("annotations");

      const getReq = store.get([entryId, annotationId]);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          const shape = { ...(record.shape_args as Record<string, unknown>) };
          for (const { key, value } of entries) {
            if (value === null) {
              delete shape[key];
            } else {
              shape[key] = value;
            }
          }
          store.put({ ...record, entryId, shape_args: shape, updated_at: new Date().toISOString() });
        }
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
      });

      // Enqueue one backend write_shapes call so a stroke is recorded on the
      // server as one change (one version, one history row).
      enqueue(backend.setShapes(annotationId, entries));
    },

    // ── Annotation change history (delegated to the shared adapter) ──

    changes(query?: IChangesQuery): Promise<IChangesResult> {
      return changesAdapter.changes(query);
    },

    version(id: string, version: number): Promise<IAnnotationRecord<Shape, Annotation>> {
      return changesAdapter.version(id, version) as unknown as Promise<IAnnotationRecord<Shape, Annotation>>;
    },
  };
};
