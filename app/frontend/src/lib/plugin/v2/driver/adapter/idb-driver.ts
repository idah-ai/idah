// ---------------------------------------------------------------------------
// idb-driver.ts
//
// IndexedDB-backed IAnnotationsDriverV2<Shape, Annotation>.
//
// Generic over <Shape, Annotation> — treats both as opaque blobs.
// No knowledge of video, image, CT, or any specific modality.
//
// createIndexedDbAnnotationsDriver is synchronous — IDB is opened lazily on
// the first fetch / create / update / delete call.
//
// Takes a plain `enqueue` function for remote driver sync operations.
// The queue implementation is the caller's concern.
// ---------------------------------------------------------------------------

import type { IAnnotationsDriverV2, IAnnotationRecord, IFilter, IFilterValue, IRangeOp } from "../../types";
import { uuidv7 } from "uuidv7";

// ─── Schema version ───────────────────────────────────────────────────────────

// Bump this when IDB_STORES changes — existing users will get onupgradeneeded.
const VERSION = 1;

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
  list(params: { filters: Record<string, unknown>; page: number; pageSize: number }): Promise<{ data: T[] }>;
  create(record: T): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
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

const openIdb = (pluginId: string): Promise<IDBDatabase> => {
  const name = `idahPlugin::${pluginId}`;
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject(e);
    req.onblocked = () => console.warn(`[idb-driver] "${name}" upgrade blocked.`);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const s of IDB_STORES) {
        const os = db.createObjectStore(s.name, s.options);
        for (const idx of s.indexes) os.createIndex(idx.name, idx.keyPath);
      }
    };
  });
};

// Fetch all annotations for an entry, optionally filtered client-side.
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
      let matches = true;
      if (filter) {
        for (const [field, expected] of Object.entries(filter)) {
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

/** Look up a single annotation by its compound key [entryId, id]. */
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
    const req = db
      .transaction(["annotations"], "readwrite")
      .objectStore("annotations")
      .add({ ...record, entryId });
    req.onsuccess = () => resolve(record);
    req.onerror = reject;
  });

const idbDelete = (db: IDBDatabase, entryId: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["annotations"], "readwrite").objectStore("annotations").delete([entryId, id]);
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });

/** Read the lastUpdatedAt timestamp for an entry, or 0 if never synced. */
const idbGetLastUpdated = (db: IDBDatabase, entryId: string): Promise<Date> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["entries"], "readonly").objectStore("entries").get(entryId);
    req.onsuccess = (e) => resolve(new Date((e.target as IDBRequest).result?.lastUpdatedAt) || 0);
    req.onerror = reject;
  });

/** Write lastUpdatedAt for an entry. */
const idbSetLastUpdated = (db: IDBDatabase, entryId: string, timestamp: Date): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = db
      .transaction(["entries"], "readwrite")
      .objectStore("entries")
      .put({ entryId, lastUpdatedAt: timestamp, lastVisitedAt: timestamp });
    req.onsuccess = () => resolve();
    req.onerror = reject;
  });

/**
 * Update lastVisitedAt for an entry without touching lastUpdatedAt.
 */
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

/** Return entryIds whose lastVisitedAt is older than cutoff. */
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

/**
 * Delete all annotations for an entry and its entry record in a single transaction.
 */
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
  // Simple equality (string / number)
  if (typeof filterValue === "string" || typeof filterValue === "number") {
    return fieldValue === filterValue;
  }

  // Range / comparison operators
  if (typeof filterValue === "object" && !Array.isArray(filterValue)) {
    const op = filterValue as IRangeOp;

    if (op.eq !== undefined) return fieldValue === op.eq;
    if (op.neq !== undefined) return fieldValue !== op.neq;

    // Number comparisons
    const num = Number(fieldValue);
    if (isNaN(num)) return false;

    if (op.gte !== undefined && num < Number(op.gte)) return false;
    if (op.gt !== undefined && num <= Number(op.gt)) return false;
    if (op.lte !== undefined && num > Number(op.lte)) return false;
    if (op.lt !== undefined && num >= Number(op.lt)) return false;

    return true; // no failing operator found
  }

  // Array-based operators
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
  /**
   * Backend transport used exclusively by the sync loop.
   * Intentionally separate from IAnnotationsDriverV2 — pagination and filter
   * serialisation are transport concerns, not consumer-facing API concerns.
   * In production this wraps the real API; in local dev use createMemoryDriver.
   */
  backend: ICrudDriver<IAnnotationRecord<Shape, Annotation>>;
  enqueue: (p: Promise<unknown>) => void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export const IdbBackedAnnotationsDriverAdapter = <
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
>(
  config: IndexedDbAnnotationsDriverConfig<Shape, Annotation>,
): IAnnotationsDriverV2<Shape, Annotation> | null => {
  // SSR / non-browser environments: signal to the caller that IDB is unavailable
  // so they can fall back to their own IAnnotationsDriverV2 implementation.
  if (typeof indexedDB === "undefined") {
    console.warn("[idb-driver] IndexedDB unavailable (SSR mode).");
    return null;
  }

  const { entryId, backend, enqueue } = config;

  // Opened lazily on first use; one connection per driver instance.
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => {
    if (!dbPromise) dbPromise = openIdb(config.pluginId);
    return dbPromise;
  };

  const virtualFields = new Map<string, (ann: IAnnotationRecord<Shape, Annotation>) => unknown>();

  // fetch once from backend lastUpdatedAt
  let synced = false;
  // Purge runs once per driver instance; no reset needed.
  let purgeScheduled = false;
  // Visit mark is written once, before the purge is ever enqueued.
  let visitMarked = false;

  return {
    registerField(name, fn) {
      virtualFields.set(name, fn as (ann: IAnnotationRecord<Shape, Annotation>) => unknown);
    },

    async fetch(filter?: IFilter): Promise<IAnnotationRecord<Shape, Annotation>[]> {
      const db = await getDb();
      // Stamp the current entry as visited before the purge can run.
      if (!visitMarked) {
        visitMarked = true;
        await idbMarkVisited(db, entryId, new Date(Date.now()));
      }

      // Purge stale entries once per session, now that the current entry is safe.
      if (!purgeScheduled) {
        purgeScheduled = true;
        const cutoff = new Date(Date.now() - EXPIRATION_PERIOD_MS);
        try {
          const staleIds = await idbGetStaleEntryIds(db, cutoff);
          for (const staleId of staleIds) await idbPurgeEntry(db, staleId);
        } catch (err) {
          console.error("Error purging stale entry", err)
          purgeScheduled = false
        }
      }

      // delta-refresh: one sync at first use
      if (!synced) {
        let lastUpdated = await idbGetLastUpdated(db, entryId);
        let page = 1, hasMore = true;
        while (hasMore) {
          const response = await backend.list({
            filters: { entry_id: entryId, updated_at__gt: lastUpdated.toISOString() },
            page,
            pageSize: SYNC_PAGE_SIZE,
          });

          response.data.forEach((a) => {
            const updatedAt = new Date(a.updated_at || 0)
            if (updatedAt > lastUpdated)
              lastUpdated = updatedAt
          })
          await idbUpsertBatch(db, entryId, response.data);
          hasMore = response.data.length === SYNC_PAGE_SIZE;
          page++;
        }
        await idbSetLastUpdated(db, entryId, lastUpdated);
        synced = true
      }

      // fetch after synced complete
      return await idbFetch<IAnnotationRecord<Shape, Annotation>>(db, entryId, virtualFields, filter);
    },

    async update(id, data): Promise<void> {
      const db = await getDb();
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, id);
      if (!existing) throw new Error(`Annotation not found: ${id}`);
      await idbUpsertBatch(db, entryId, [{ ...existing, ...data }]);
      enqueue(backend.update(id, data));
    },

    async delete(id): Promise<void> {
      const db = await getDb();
      await idbDelete(db, entryId, id);
      enqueue(backend.delete(id));
    },

    async create(data): Promise<IAnnotationRecord<Shape, Annotation>> {
      const db = await getDb();
      const record = { ...data, id: data.id ?? uuidv7() } as IAnnotationRecord<Shape, Annotation>;
      await idbCreate(db, entryId, record);
      enqueue(backend.create(record));
      return record;
    },
  };
};
