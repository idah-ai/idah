import type { ImageAnnotationObject, ImageFrameSelection } from "$lib/context/image-annotation-context";

export const storeDefinition: StoresDefinition = {
  annotations: [
    { index: "start", path: "shape.start", opts: { unique: false } },
    { index: "end", path: "shape.end", opts: { unique: false } },
    { index: "range", path: "shape.range", opts: { unique: false } },
    { index: "type", path: "shape.type", opts: { unique: false } },
    { index: "category", path: "value.category", opts: { unique: false } },
    { index: "created_at", path: "metadata.createdAt", opts: { unique: false } },
    { index: "updated_at", path: "metadata.updatedAt", opts: { unique: false } },
    { index: "groupIdIndex", path: "metadata.metadata.group_id", opts: { unique: false } },
  ],
  keyframes: [
    { index: "frame", path: "frame", opts: { unique: false } },
    { index: "annotation", path: "annotation", opts: { unique: false } },
  ],
};

export type StoreDefinition = {
  index: string;
  path: string;
  opts?: IDBIndexParameters;
};

export type StoresDefinition = {
  [name: string]: StoreDefinition[];
};

// the current version of IndexedDB, bump incrementally if there's a change
export const currentDBVersion: number = 2;

/**
 * Pure IndexedDB database layer
 * Handles only CRUD operations, no business logic or state management
 */
export class AnnotationsIndexedDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  /**
   * Get a single item by key
   */
  async get(store_name: string, key: string): Promise<ImageAnnotationObject> {
    return new Promise<ImageAnnotationObject>((resolve, reject) => {
      const transaction = this.db.transaction(store_name, "readonly");
      const store = transaction.objectStore(store_name);
      const request = store.get(key);

      request.onsuccess = (_) => resolve(request.result);
      request.onerror = (_) => reject(request.error);
    });
  }

  /**
   * Get all items from a store with optional sorting using IndexedDB indexes
   * Uses cursors for efficient sorting at the database level
   */
  async getAll(
    storename: string,
    options?: {
      sortBy?: "created_at" | "updated_at" | "start" | "end";
      sortDirection?: "asc" | "desc";
    },
  ): Promise<ImageAnnotationObject[]> {
    return new Promise<ImageAnnotationObject[]>((resolve, reject) => {
      const transaction = this.db.transaction(storename, "readonly");
      const store = transaction.objectStore(storename);

      // If no sorting specified, use simple getAll()
      if (!options?.sortBy) {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        return;
      }

      // Use indexed cursor for efficient sorting
      const results: ImageAnnotationObject[] = [];
      const direction = options.sortDirection === "desc" ? "prev" : "next";

      try {
        const index = store.index(options.sortBy);
        const cursorRequest = index.openCursor(null, direction);

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      } catch (error) {
        // Fallback to unsorted if index doesn't exist
        console.warn(`Index "${options.sortBy}" not found, falling back to unsorted results`, error);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  /**
   * Get all items by index
   */
  async getAllByIndex(key: string, value?: string): Promise<ImageAnnotationObject[]> {
    return new Promise<ImageAnnotationObject[]>((resolve, reject) => {
      const transaction = this.db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations").index(key);
      const keyRange = value != undefined ? IDBKeyRange.only(value) : undefined;
      const request = store.getAll(keyRange);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put (upsert) an annotation
   */
  async putAnnotation(annotation: ImageAnnotationObject): Promise<void> {
    const transaction = this.db.transaction(["annotations", "keyframes"], "readwrite");
    const astore = transaction.objectStore("annotations");
    const kstore = transaction.objectStore("keyframes");

    astore.put(
      {
        ...annotation,
        value: {
          ...annotation.value,
          category: annotation.value.category || "null",
        },
      },
      annotation.metadata.id,
    );

    annotation.shape.frames?.forEach((k: ImageFrameSelection) => {
      kstore.put({ annotation: annotation.metadata.id, ...k }, [annotation.metadata.id, k.frame]);
    });

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject();
    });
  }

  /**
   * Put (upsert) multiple annotations
   */
  async putAnnotations(annotations: ImageAnnotationObject[]): Promise<void> {
    const transaction = this.db.transaction(["annotations", "keyframes"], "readwrite");
    const astore = transaction.objectStore("annotations");
    const kstore = transaction.objectStore("keyframes");

    annotations.forEach((annotation) => {
      console.debug({ IDBtype: "put", annotation });
      astore.put(
        {
          ...annotation,
          value: {
            ...annotation.value,
            category: annotation.value.category || "null",
          },
        },
        annotation.metadata.id,
      );

      annotation.shape.frames?.forEach((k: ImageFrameSelection) => {
        kstore.put({ annotation: annotation.metadata.id, ...k }, [annotation.metadata.id, k.frame]);
      });
    });

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject();
    });
  }

  /**
   * Delete an annotation and its keyframes
   */
  async deleteAnnotation(annotation_id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ktransaction = this.db.transaction("keyframes", "readwrite");
      const kstore = ktransaction.objectStore("keyframes");
      const range = IDBKeyRange.bound([annotation_id, 0], [annotation_id + " ", 0]);
      const request = kstore.delete(range);

      request.onsuccess = (_) => {
        const atransaction = this.db.transaction("annotations", "readwrite");
        const astore = atransaction.objectStore("annotations");
        const deleteRequest = astore.delete(annotation_id);

        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      request.onerror = (_) => reject(request.error);
    });
  }

  /**
   * Add a keyframe to an annotation
   */
  async addKeyFrame(annotation_id: string, keyFrame: ImageFrameSelection): Promise<void> {
    const transaction = this.db.transaction(["annotations", "keyframes"], "readwrite");
    const kstore = transaction.objectStore("keyframes");
    const astore = transaction.objectStore("annotations");

    kstore.put({ annotation: annotation_id, ...keyFrame }, [annotation_id, keyFrame.frame]);

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = async () => {
        // Fetch and update the annotation with all keyframes
        const annotation = (await this.get("annotations", annotation_id)) as ImageAnnotationObject;
        const keyframes = await this.getKeyFrames(annotation_id);
        annotation.shape.frames = keyframes;
        await astore.put(annotation, annotation_id);
        resolve();
      };
      transaction.onerror = (e) => reject(e);
    });
  }

  /**
   * Delete a keyframe from an annotation
   */
  async deleteKeyFrame(annotation_id: string, frame: number): Promise<void> {
    const transaction = this.db.transaction("keyframes", "readwrite");
    const store = transaction.objectStore("keyframes");
    const request = store.delete([annotation_id, frame]);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = (r) => reject(r);
    });
  }

  /**
   * Get all keyframes for an annotation
   */
  async getKeyFrames(annotation_id: string): Promise<ImageFrameSelection[]> {
    return new Promise<ImageFrameSelection[]>((resolve, reject) => {
      const transaction = this.db.transaction("keyframes", "readonly");
      const index = transaction.objectStore("keyframes").index("annotation");
      const request = index.getAll(IDBKeyRange.only(annotation_id));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all annotations in a group
   */
  async getGroupAnnotations(groupId: string): Promise<ImageAnnotationObject[]> {
    const transaction = this.db.transaction("annotations", "readonly");
    const store = transaction.objectStore("annotations");

    const idPromise = new Promise<ImageAnnotationObject | undefined>((resolve, reject) => {
      const request = store.get(groupId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const groupPromise = new Promise<ImageAnnotationObject[]>((resolve, reject) => {
      const request = store.index("groupIdIndex").getAll(IDBKeyRange.only(groupId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return Promise.all([idPromise, groupPromise]).then(([idResult, groupResults]) => {
      const allResults = [...groupResults];
      if (idResult && !allResults.some((r) => r.metadata.id === idResult.metadata.id)) {
        allResults.push(idResult);
      }
      return allResults.sort((a, b) => a.shape.start - b.shape.start);
    });
  }

  /**
   * Update all annotations with a transformation function
   */
  async updateAll(updateFn: (annotation: ImageAnnotationObject) => ImageAnnotationObject): Promise<void> {
    const transaction = this.db.transaction(["annotations"], "readwrite");
    const objectStore = transaction.objectStore("annotations");

    return new Promise<void>((resolve, reject) => {
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)?.result;
        if (cursor) {
          try {
            const updated = updateFn(cursor.value);
            cursor.update(updated);
          } catch (error) {
            reject(error);
            return;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject((event.target as IDBRequest)?.error);
      transaction.onabort = (event) => reject((event.target as IDBRequest)?.error);
    });
  }
}

/**
 * Initialize IndexedDB and return database instance
 */
export async function openAnnotationsDB(name: string, stores: StoresDefinition = storeDefinition) {
  return new Promise<AnnotationsIndexedDB>((resolve, reject) => {
    const DBOpenRequest = indexedDB.open(name, currentDBVersion);

    DBOpenRequest.onerror = reject;
    DBOpenRequest.onsuccess = (_) => {
      console.info("Database initialized.");
      const db = new AnnotationsIndexedDB(DBOpenRequest.result);
      resolve(db);
    };

    DBOpenRequest.onupgradeneeded = () => {
      console.info("Upgrading database...");
      const db = DBOpenRequest.result;

      // Delete all existing object stores
      Array.from(db.objectStoreNames).forEach((store) => {
        db.deleteObjectStore(store);
      });

      // Create object stores and indexes
      Object.entries(stores).forEach(([store, indexes]) => {
        const s = db.createObjectStore(store);
        indexes.forEach((i) => s.createIndex(i.index, i.path, i?.opts));
      });

      console.info("Database upgraded.");
    };
  });
}
