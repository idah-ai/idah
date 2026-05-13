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

import type {
  IAnnotationsDriverV2,
  IAnnotationRecord,
  IFilter,
} from "$idah/v2/types";
import { InMemoryStore } from "./in-memory-store";
import { uuidv7 } from "uuidv7";

// ─── Schema version ───────────────────────────────────────────────────────────

// Bump this when IDB_STORES changes — existing users will get onupgradeneeded.
const VERSION = 1;

// ─── ICrudDriver ──────────────────────────────────────────────────────────────

export interface ICrudDriver<T extends { id: string }> {
  list(params: {
    filters: Record<string, unknown>;
    page: number;
    pageSize: number;
  }): Promise<{ data: T[] }>;
  create(record: T): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

// ─── MemoryDriver ─────────────────────────────────────────────────────────────

export const createMemoryDriver = <T extends { id: string }>(
  store: InMemoryStore<T>,
): ICrudDriver<T> => ({
  list: async ({ filters, page, pageSize }) => {
    const { updated_at__gt: _gt, entry_id: _eid, ...rest } = filters as Record<string, unknown>;
    const all   = store.fetch(Object.keys(rest).length > 0 ? rest as IFilter : undefined);
    const start = (page - 1) * pageSize;
    return { data: all.slice(start, start + pageSize) };
  },
  create: async (record) => store.create(record),
  update: async (id, data) => { store.update(id, data); },
  delete: async (id) => { store.delete(id); },
});

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
    req.onsuccess       = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror         = (e) => reject(e);
    req.onblocked       = () => console.warn(`[idb-driver] "${name}" upgrade blocked.`);
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
// Intentionally uses a cursor rather than index-based range filtering to
// support arbitrary nested-path and virtual-field predicates uniformly.
// TODO: leverage IDB indexes for common filter patterns once the filter
//       surface stabilises.
const idbFetch = <T extends { id: string }>(db: IDBDatabase, entryId: string, virtualFields?: Map<string, (ann: T) => unknown>, filter?: IFilter): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const results: T[] = [];
    const range = IDBKeyRange.only(entryId);
    const req   = db.transaction(["annotations"], "readonly")
      .objectStore("annotations").index("entryId").openCursor(range);
    req.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!c) { resolve(results); return; }
      const rec = c.value;
      let matches = true;
      if (filter) {
        for (const [field, expected] of Object.entries(filter)) {
          const val = virtualFields && virtualFields.has(field)
            ? virtualFields.get(field)!(rec)
            : resolvePath(rec, field);
          if (!matchesFilter(val, expected)) { matches = false; break; }
        }
      }
      if (matches) results.push({ ...rec });
      c.continue();
    };
    req.onerror = reject;
  });

/** Look up a single annotation by its compound key [entryId, id]. */
const idbGet = <T extends { id: string }>(
  db: IDBDatabase, entryId: string, id: string,
): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["annotations"], "readonly")
      .objectStore("annotations").get([entryId, id]);
    req.onsuccess = (e) => resolve((e.target as IDBRequest<T | undefined>).result);
    req.onerror   = reject;
  });

const idbUpsertBatch = <T extends { id: string }>(
  db: IDBDatabase, entryId: string, records: T[],
): Promise<void> => {
  if (!records.length) return Promise.resolve();
  const tx = db.transaction(["annotations"], "readwrite");
  const os = tx.objectStore("annotations");
  for (const r of records) os.put({ ...r, entryId });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
};

const idbCreate = <T extends { id: string }>(
  db: IDBDatabase, entryId: string, record: T,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["annotations"], "readwrite")
      .objectStore("annotations").add({ ...record, entryId });
    req.onsuccess = () => resolve(record);
    req.onerror   = reject;
  });

const idbDelete = (db: IDBDatabase, entryId: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["annotations"], "readwrite")
      .objectStore("annotations").delete([entryId, id]);
    req.onsuccess = () => resolve();
    req.onerror   = reject;
  });

/** Read the lastUpdatedAt timestamp for an entry, or 0 if never synced. */
const idbGetLastUpdated = (db: IDBDatabase, entryId: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["entries"], "readonly")
      .objectStore("entries").get(entryId);
    req.onsuccess = (e) => resolve((e.target as IDBRequest).result?.lastUpdatedAt ?? 0);
    req.onerror   = reject;
  });

/** Write lastUpdatedAt for an entry. */
const idbSetLastUpdated = (db: IDBDatabase, entryId: string, timestamp: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = db.transaction(["entries"], "readwrite")
      .objectStore("entries").put({ entryId, lastUpdatedAt: timestamp, lastVisitedAt: timestamp });
    req.onsuccess = () => resolve();
    req.onerror   = reject;
  });

/**
 * Update lastVisitedAt for an entry without touching lastUpdatedAt.
 * Read-modify-write within a single transaction to preserve the sync watermark.
 */
const idbMarkVisited = (db: IDBDatabase, entryId: string, timestamp: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx    = db.transaction(["entries"], "readwrite");
    const store = tx.objectStore("entries");
    const req   = store.get(entryId);
    req.onsuccess = (e) => {
      const existing = (e.target as IDBRequest).result ?? { entryId, lastUpdatedAt: 0 };
      store.put({ ...existing, entryId, lastVisitedAt: timestamp });
    };
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });

/** Return entryIds whose lastVisitedAt is older than cutoff. */
const idbGetStaleEntryIds = (db: IDBDatabase, cutoff: number): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const stale: string[] = [];
    const range = IDBKeyRange.upperBound(cutoff);
    const req   = db.transaction(["entries"], "readonly")
      .objectStore("entries").index("lastVisitedAt").openCursor(range);
    req.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!c) { resolve(stale); return; }
      stale.push(c.value.entryId);
      c.continue();
    };
    req.onerror = reject;
  });

/**
 * Delete all annotations for an entry and its entry record in a single transaction.
 * Uses a cursor over the entryId index so every annotation is removed regardless
 * of how many there are, without needing to know individual ids upfront.
 */
const idbPurgeEntry = (db: IDBDatabase, entryId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx        = db.transaction(["annotations", "entries"], "readwrite");
    const annoStore = tx.objectStore("annotations");
    const range     = IDBKeyRange.only(entryId);
    const req       = annoStore.index("entryId").openCursor(range);
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
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });

// ─── Filter engine ────────────────────────────────────────────────────────────

const resolvePath = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>(
    (acc, k) => acc != null ? (acc as Record<string, unknown>)[k] : undefined,
    obj,
  );

const matchesFilter = (val: unknown, expected: unknown): boolean => {
  if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
    const op  = expected as Record<string, unknown>;
    const num = Number(val);
    if ("lte" in op && num > Number(op.lte)) return false;
    if ("gte" in op && num < Number(op.gte)) return false;
    if ("lt"  in op && num >= Number(op.lt))  return false;
    if ("gt"  in op && num <= Number(op.gt))  return false;
    if ("eq"  in op && val !== op.eq)          return false;
    if ("neq" in op && val === op.neq)         return false;
    return true;
  }
  return val === expected;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_PAGE_SIZE       = 100;
const EXPIRATION_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

// ─── Config ───────────────────────────────────────────────────────────────────

export interface IndexedDbAnnotationsDriverConfig<
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
> {
  entryId:  string;
  pluginId: string;
  driver:   ICrudDriver<IAnnotationRecord<Shape, Annotation>>;
  enqueue:  (op: () => Promise<void>) => void;
  // TODO: enqueue must handle errors internally (log, retry, dead-letter, etc.)
  //       — this driver intentionally does not catch errors thrown by enqueued ops.
}

// ─── SSR fallback driver ──────────────────────────────────────────────────────

// When IndexedDB is unavailable (SSR / Node.js), an in-memory Map serves as
// the local cache. The delta-sync pattern is identical to the IDB driver:
// fetch returns the cached snapshot immediately, then enqueues a background
// refresh that only pulls records updated since the last sync.
const createSsrAnnotationsDriver = <
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
>(
  config: IndexedDbAnnotationsDriverConfig<Shape, Annotation>,
): IAnnotationsDriverV2<Shape, Annotation> => {
  const { entryId, driver, enqueue } = config;
  const virtualFields = new Map<string, (ann: IAnnotationRecord<Shape, Annotation>) => unknown>();

  // In-memory equivalents of IDB storage + the entries timestamp store.
  const cache       = new Map<string, IAnnotationRecord<Shape, Annotation>>();
  let lastUpdatedAt = 0;
  let syncEnqueued  = false;

  const applyFilter = (filter?: IFilter): IAnnotationRecord<Shape, Annotation>[] => {
    const all = [...cache.values()];
    if (!filter) return all;
    return all.filter((rec) => {
      for (const [field, expected] of Object.entries(filter)) {
        const val = virtualFields.has(field)
          ? virtualFields.get(field)!(rec)
          : resolvePath(rec, field);
        if (!matchesFilter(val, expected)) return false;
      }
      return true;
    });
  };

  return {
    registerField(name, fn) {
      virtualFields.set(name, fn as (ann: IAnnotationRecord<Shape, Annotation>) => unknown);
    },

    async fetch(filter?: IFilter) {
      // Return the cached snapshot before enqueueing any sync that could mutate it.
      const results = applyFilter(filter);

      if (!syncEnqueued) {
        syncEnqueued = true;
        enqueue(async () => {
          try {
            const fetchedAt = Date.now();
            let page = 1, hasMore = true;
            while (hasMore) {
              const res = await driver.list({
                filters: { entry_id: entryId, updated_at__gt: lastUpdatedAt },
                page, pageSize: SYNC_PAGE_SIZE,
              });
              for (const record of res.data) cache.set(record.id, record);
              hasMore = res.data.length === SYNC_PAGE_SIZE;
              page++;
            }
            lastUpdatedAt = fetchedAt;
          } finally {
            syncEnqueued = false;
          }
        });
      }

      return results;
    },

    async update(id, data) {
      const existing = cache.get(id);
      if (existing) cache.set(id, { ...existing, ...data });
      enqueue(() => driver.update(id, data));
    },

    async delete(id) {
      cache.delete(id);
      enqueue(() => driver.delete(id));
    },

    async create(data) {
      const record = { ...data, id: data.id ?? uuidv7() } as IAnnotationRecord<Shape, Annotation>;
      cache.set(record.id, record);
      enqueue(() => driver.create(record).then(() => {}));
      return record;
    },
  };
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createIndexedDbAnnotationsDriver = <
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
>(
  config: IndexedDbAnnotationsDriverConfig<Shape, Annotation>,
): IAnnotationsDriverV2<Shape, Annotation> => {
  // SSR / non-browser environments: IndexedDB is unavailable.
  // Fall back to a thin driver that reads/writes directly through the ICrudDriver.
  if (typeof indexedDB === "undefined") {
    console.warn("[idb-driver] IndexedDB unavailable — using direct driver (SSR mode).");
    return createSsrAnnotationsDriver(config);
  }

  const { entryId, driver, enqueue } = config;

  // Opened lazily on first use; one connection per driver instance.
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => {
    if (!dbPromise) dbPromise = openIdb(config.pluginId);
    return dbPromise;
  };

  const virtualFields = new Map<string, (ann: IAnnotationRecord<Shape, Annotation>) => unknown>();

  // Guards against enqueueing multiple overlapping delta-syncs for the same
  // driver instance (e.g. rapid re-renders or polling).
  let syncEnqueued  = false;
  // Purge runs once per driver instance; no reset needed.
  let purgeScheduled = false;
  // Visit mark is written once, before the purge is ever enqueued.
  let visitMarked    = false;

  return {
    registerField(name, fn) {
      virtualFields.set(name, fn as (ann: IAnnotationRecord<Shape, Annotation>) => unknown);
    },

    async fetch(filter?: IFilter): Promise<IAnnotationRecord<Shape, Annotation>[]> {
      const db = await getDb();

      // Stamp the current entry as visited before the purge can run.
      // Awaited so the write is durable in IDB before we enqueue anything.
      if (!visitMarked) {
        visitMarked = true;
        await idbMarkVisited(db, entryId, Date.now());
      }

      // Read from IDB first so the caller always gets the cached snapshot
      // before any in-flight sync can write to the store.
      const results = await idbFetch<IAnnotationRecord<Shape, Annotation>>(db, entryId, virtualFields, filter);

      // Purge stale entries once per session, now that the current entry is safe.
      if (!purgeScheduled) {
        purgeScheduled = true;
        enqueue(async () => {
          const cutoff   = Date.now() - EXPIRATION_PERIOD_MS;
          const staleIds = await idbGetStaleEntryIds(db, cutoff);
          for (const staleId of staleIds) await idbPurgeEntry(db, staleId);
        });
      }

      // Background delta-refresh: enqueue at most one sync at a time.
      // The next fetch after the current sync completes will enqueue a fresh one.
      if (!syncEnqueued) {
        syncEnqueued = true;
        enqueue(async () => {
          try {
            const lastUpdated = await idbGetLastUpdated(db, entryId);
            const fetchedAt   = Date.now();
            let page = 1, hasMore = true;
            while (hasMore) {
              const response = await driver.list({
                filters: { entry_id: entryId, updated_at__gt: lastUpdated },
                page, pageSize: SYNC_PAGE_SIZE,
              });
              await idbUpsertBatch(db, entryId, response.data);
              hasMore = response.data.length === SYNC_PAGE_SIZE;
              page++;
            }
            await idbSetLastUpdated(db, entryId, fetchedAt);
          } finally {
            syncEnqueued = false;
          }
        });
      }

      return results;
    },

    async update(id, data): Promise<void> {
      const db = await getDb();
      const existing = await idbGet<IAnnotationRecord<Shape, Annotation>>(db, entryId, id);
      if (!existing) throw new Error(`Annotation not found: ${id}`);
      await idbUpsertBatch(db, entryId, [{ ...existing, ...data }]);
      enqueue(() => driver.update(id, data));
    },

    async delete(id): Promise<void> {
      const db = await getDb();
      await idbDelete(db, entryId, id);
      enqueue(() => driver.delete(id));
    },

    async create(data): Promise<IAnnotationRecord<Shape, Annotation>> {
      const db = await getDb();
      // IAnnotationRecord.id is required (string), so data.id is always defined.
      // uuidv7() is kept as a safety net for untyped callers passing a partial record.
      const record = { ...data, id: data.id ?? uuidv7() } as IAnnotationRecord<Shape, Annotation>;
      await idbCreate(db, entryId, record);
      enqueue(() => driver.create(record).then(() => {}));
      return record;
    },
  };
};
