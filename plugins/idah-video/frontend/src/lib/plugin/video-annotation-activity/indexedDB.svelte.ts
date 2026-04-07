import {
  type VideoAnnotationObject,
  type VideoFrameSelection,
} from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

// the current version of IndexedDB, bump incrementally if there's a change
const currentDBVersion: number = 2;

const storeDefinition: StoresDefinition = {
  annotations: [
    { index: "start", path: "shape.start", opts: { unique: false } },
    { index: "end", path: "shape.end", opts: { unique: false } },
    { index: "range", path: "shape.range", opts: { unique: false } },
    { index: "type", path: "shape.type", opts: { unique: false } },
    { index: "category", path: "value.category", opts: { unique: false } },
    { index: "created_at", path: "metadata.updatedAt", opts: { unique: false } },
    { index: "updated_at", path: "metadata.createdAt", opts: { unique: false } },
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

export async function annotationsIndexedDB(name: string, stores: StoresDefinition = storeDefinition) {
  return new Promise<AnnotationsIndexedDB>((resolve, reject) => {
    const DBOpenRequest = indexedDB.open(name, currentDBVersion);

    DBOpenRequest.onerror = reject;
    DBOpenRequest.onsuccess = (_) => {
      console.info("Database initialized.");
      resolve(new AnnotationsIndexedDB(DBOpenRequest.result));
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

export class AnnotationsIndexedDB {
  private db: IDBDatabase;
  private annotationsState = $state<VideoAnnotationObject[]>([]);

  constructor(db: IDBDatabase) {
    this.db = db;
    this.loadAnnotations();
  }

  /**
   * Reactive annotations getter - returns a snapshot to prevent external mutations
   */
  get annotations(): VideoAnnotationObject[] {
    return this.annotationsState;
  }

  /**
   * Load all annotations from IndexedDB and update the reactive state
   */
  private async loadAnnotations(): Promise<void> {
    try {
      const allAnnotations = await this.getAllStore("annotations");
      this.annotationsState = allAnnotations;
    } catch (error) {
      console.error("Failed to load annotations:", error);
      this.annotationsState = [];
    }
  }

  /**
   * Upsert annotations into IndexedDB
   */
  async upsertAnnotations(annotations: VideoAnnotationObject[]): Promise<void> {
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

      annotation.shape.frames?.forEach((k: VideoFrameSelection) => {
        console.debug({ IDBtype: "put", keyframe: k });
        kstore.put({ annotation: annotation.metadata.id, ...k }, [annotation.metadata.id, k.frame]);
      });
    });

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = async () => {
        await this.loadAnnotations();
        resolve();
      };
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

        deleteRequest.onsuccess = async () => {
          await this.loadAnnotations();
          resolve();
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      request.onerror = (_) => {
        reject(request.error);
      };
    });
  }

  /**
   * Get a single annotation by ID
   */
  async get(store_name: string, key: string): Promise<VideoAnnotationObject> {
    return new Promise<VideoAnnotationObject>((resolve, reject) => {
      const transaction = this.db.transaction(store_name, "readonly");
      const store = transaction.objectStore(store_name);
      const request = store.get(key);

      request.onsuccess = (_) => resolve(request.result);
      request.onerror = (_) => reject(request.error);
    });
  }

  /**
   * Get all annotations in a group
   */
  async getGroupAnnotations(groupId: string): Promise<VideoAnnotationObject[]> {
    const transaction = this.db.transaction("annotations", "readonly");
    const store = transaction.objectStore("annotations");

    const idPromise = new Promise<VideoAnnotationObject | undefined>((resolve, reject) => {
      const request = store.get(groupId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const groupPromise = new Promise<VideoAnnotationObject[]>((resolve, reject) => {
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
   * Add a keyframe to an annotation
   */
  async addKeyFrame(annotation: VideoAnnotationObject, keyFrame: VideoFrameSelection): Promise<void> {
    const transaction = this.db.transaction(["annotations", "keyframes"], "readwrite");
    const store = transaction.objectStore("keyframes");
    const Astore = transaction.objectStore("annotations");
    const request = store.put({ annotation: annotation.metadata.id, ...keyFrame }, [
      annotation.metadata.id,
      keyFrame.frame,
    ]);
    const index = transaction.objectStore("keyframes").index("annotation");

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const Arequest = Astore.get(annotation.metadata.id);

        Arequest.onsuccess = () => {
          const annotation = Arequest.result as VideoAnnotationObject;
          const keyframesRequest = index.getAll(IDBKeyRange.only(annotation.metadata.id));

          keyframesRequest.onsuccess = () => {
            const keyframes = keyframesRequest.result;
            annotation.shape.frames = keyframes;
            Astore.put(annotation, annotation.metadata.id);
          };
        };
      };

      transaction.oncomplete = async () => {
        await this.loadAnnotations();
        resolve();
      };
      transaction.onerror = (e) => reject(e);
    });
  }

  /**
   * Delete a keyframe from an annotation
   */
  async deleteKeyFrame(annotation: VideoAnnotationObject, frame: number): Promise<void> {
    const transaction = this.db.transaction("keyframes", "readwrite");
    const store = transaction.objectStore("keyframes");
    const request = store.delete([annotation.metadata.id, frame]);

    return new Promise<void>((resolve, reject) => {
      request.onerror = (r) => reject(r);
      request.onsuccess = async (r) => {
        console.debug(r);
        await this.loadAnnotations();
        resolve();
      };
    });
  }

  /**
   * Get all annotations by index
   */
  async getAllIndex(key: string, value?: string): Promise<VideoAnnotationObject[]> {
    return new Promise<VideoAnnotationObject[]>((resolve, reject) => {
      const transaction = this.db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations").index(key);

      const keyRange = value != undefined ? IDBKeyRange.only(value) : undefined;
      const request = store.getAll(keyRange);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update visibility for all annotations
   */
  async updateAllVisibility(hidden: boolean): Promise<void> {
    const transaction = this.db.transaction(["annotations"], "readwrite");
    const objectStore = transaction.objectStore("annotations");

    return new Promise<void>((resolve, reject) => {
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)?.result;

        if (cursor) {
          try {
            const updateData = cursor.value;
            updateData.hidden = hidden;
            cursor.update(updateData);
          } catch (error) {
            reject(error);
            return;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = async () => {
        await this.loadAnnotations();
        resolve();
      };
      transaction.onerror = (event) => {
        reject((event.target as IDBRequest)?.error);
      };
      transaction.onabort = (event) => {
        reject((event.target as IDBRequest)?.error);
      };
    });
  }

  /**
   * Update lock state for all annotations
   */
  async updateAllLock(locked: boolean): Promise<void> {
    const transaction = this.db.transaction(["annotations"], "readwrite");
    const objectStore = transaction.objectStore("annotations");

    return new Promise<void>((resolve, reject) => {
      objectStore.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)?.result;

        if (cursor) {
          try {
            const updateData = cursor.value;
            updateData.locked = locked;
            cursor.update(updateData);
          } catch (error) {
            reject(error);
            return;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = async () => {
        await this.loadAnnotations();
        resolve();
      };
      transaction.onerror = (event) => {
        reject((event.target as IDBRequest)?.error);
      };
      transaction.onabort = (event) => {
        reject((event.target as IDBRequest)?.error);
      };
    });
  }

  /**
   * Get all items from a store
   */
  async getAllStore(storename: string): Promise<VideoAnnotationObject[]> {
    return new Promise<VideoAnnotationObject[]>((resolve, reject) => {
      const transaction = this.db.transaction(storename, "readonly");
      const store = transaction.objectStore(storename);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all annotations where category starts with a value
   */
  async getAllStartingWith(key: string, value: string): Promise<VideoAnnotationObject[]> {
    return new Promise<VideoAnnotationObject[]>((resolve, reject) => {
      const transaction = this.db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations").index(key);
      const keyRange = IDBKeyRange.lowerBound(value);

      const request = store.openCursor(keyRange);

      const result: VideoAnnotationObject[] = [];
      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor && cursor.value.value.category.startsWith(value)) {
          result.push(cursor.value);
          cursor.continue();
        } else {
          // stop cursor
          resolve(result);
        }
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}
