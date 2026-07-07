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
import type { IAnnotationsDriverV2, IAnnotationRecord, IFilter, IFilterValue, IRangeOp } from "../../types";
import { uuidv7 } from "uuidv7";

// ─── Schema version ───────────────────────────────────────────────────────────

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
  list(params: ListOptions): Promise<{ data: T[] }>;
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
      if (!filter || recordMatches(rec, filter, virtualFields)) results.push({ ...rec });
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

/** Whether a record satisfies every field of `filter` (virtual fields resolved). */
const recordMatches = <T extends { id: string }>(
  rec: T,
  filter: IFilter,
  virtualFields?: Map<string, (ann: T) => unknown>,
): boolean => {
  for (const [field, expected] of Object.entries(filter)) {
    const val = virtualFields && virtualFields.has(field) ? virtualFields.get(field)!(rec) : resolvePath(rec, field);
    if (!matchesFilter(val, expected)) return false;
  }
  return true;
};

// ─── Config ───────────────────────────────────────────────────────────────────

export interface IndexedDbAnnotationsDriverConfig<
  Shape = Record<string, unknown>,
  Annotation = Record<string, unknown>,
> {
  entryId: string;
  pluginId: string;
  backend: ICrudDriver<IAnnotationRecord<Shape, Annotation>>;
  enqueue: (p: Promise<unknown>) => void;
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
    if (!dbPromise) dbPromise = openIdb(config.pluginId);
    return dbPromise;
  };

  const virtualFields = new Map<string, (ann: IAnnotationRecord<Shape, Annotation>) => unknown>();

  let synced = false;
  let purgeScheduled = false;
  let visitMarked = false;

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
      };
    },

    async clearCache() {
      const db = await getDb();
      await idbPurgeEntry(db, entryId);
    },

    async fetch(
      filter?: IFilter,
      onBatch?: (records: IAnnotationRecord<Shape, Annotation>[]) => void,
    ): Promise<IAnnotationRecord<Shape, Annotation>[]> {
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

      if (!synced) {
        const lastUpdated = await idbGetLastUpdated(db, entryId);
        let currentLastUpdatedAt = lastUpdated;
        let page = 1,
          hasMore = true;
        while (hasMore) {
          const response = await backend.list({
            filters: { entry_id: entryId, updated_at__gte: lastUpdated.toISOString() },
            sort: ["updated_at"],
            pagination: {
              page,
              itemsPerPage: SYNC_PAGE_SIZE,
            },
          });
          response.data.forEach((a) => {
            const updatedAt = new Date(a.updated_at || 0);
            if (updatedAt > currentLastUpdatedAt) currentLastUpdatedAt = updatedAt;
          });
          await idbUpsertBatch(db, entryId, response.data);
          if (onBatch && response.data.length) {
            const matched = filter
              ? response.data.filter((r) => recordMatches(r, filter, virtualFields))
              : response.data;
            if (matched.length) onBatch(matched.map((r) => ({ ...r })));
          }
          hasMore = response.data.length === SYNC_PAGE_SIZE;
          page++;
        }
        await idbSetLastUpdated(db, entryId, currentLastUpdatedAt);
        synced = true;
      }

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
