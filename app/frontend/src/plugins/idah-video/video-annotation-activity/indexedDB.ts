import { type VideoAnnotation, type Point, X, Y, type VideoFrameSelection } from "./VideoAnnotationContext";

//test
const s = {
  annotations: [
    { index: "start", path: "shape.start", opts: { unique: false } },
    { index: "end", path: "shape.end", opts: { unique: false } },
    { index: "range", path: "shape.range", opts: { unique: false } },
    { index: "type", path: "shape.type", opts: { unique: false } },
    { index: "category", path: "value.category", opts: { unique: false } },
    { index: "created_at", path: "metadata.updatedAt", opts: { unique: false } },
    { index: "updated_at", path: "metadata.createdAt", opts: { unique: false } },
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

export async function annotationsIndexedDB(name: string, stores: StoresDefinition = s) {
  return new Promise<AnnotationsIndexedDB>((resolve, reject) => {
    const DBOpenRequest = indexedDB.open(name, 1);
    DBOpenRequest.onerror = reject;
    DBOpenRequest.onsuccess = (_) => {
      console.info("Database initialized.");
      resolve(new AnnotationsIndexedDB(DBOpenRequest.result));
    };

    DBOpenRequest.onupgradeneeded = () => {
      console.info("upgrade Database.");

      Object.entries(stores).forEach(([store, indexes]) => {
        const s = DBOpenRequest.result.createObjectStore(store);
        indexes.forEach((i) => s.createIndex(i.index, i.path, i?.opts));
      });
    };
  });
}

export class AnnotationsIndexedDB {
  db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  addAnnotations(annotations: VideoAnnotation[]): Promise<void> {
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

      annotation.shape.frames.forEach((k) => {
        console.debug({ IDBtype: "put", keyframe: k });
        kstore.put({ annotation: annotation.metadata.id, ...k }, [annotation.metadata.id, k.frame]);
      });
    });

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject();
    });
  }

  deleteAnnotation(annotation_id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ktransaction = this.db.transaction("keyframes", "readwrite");
      const kstore = ktransaction.objectStore("keyframes");

      const range = IDBKeyRange.bound([annotation_id, 0], [annotation_id + " ", 0]);
      const request = kstore.delete(range);

      request.onsuccess = (_) => {
        const atransaction = this.db.transaction("annotations", "readwrite");
        const astore = atransaction.objectStore("annotations");

        const request = astore.delete(annotation_id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      };
      request.onerror = (_) => {
        reject(request.error);
      };
    });
  }

  get(store_name: string, key: any): Promise<VideoAnnotation> {
    return new Promise<VideoAnnotation>((resolve, reject) => {
      const transaction = this.db.transaction(store_name, "readonly");
      const store = transaction.objectStore(store_name);
      const request = store.get(key);

      request.onsuccess = (_) => resolve(request.result);
      request.onerror = (_) => reject(request.error);
    });
  }

  addKeyFrame(annotation: VideoAnnotation, keyFrame: KeyFrame) {
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
          const annotation = Arequest.result as VideoAnnotation;
          const keyframesRequest = index.getAll(IDBKeyRange.only(annotation.metadata.id));

          keyframesRequest.onsuccess = () => {
            const keyframes = keyframesRequest.result;

            annotation.shape.frames = keyframes;

            Astore.put(annotation, annotation.metadata.id);
          };
        };
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    });
  }

  deleteKeyFrame(annotation: VideoAnnotation, frame: number): Promise<void> {
    const transaction = this.db.transaction("keyframes", "readwrite");
    const store = transaction.objectStore("keyframes");
    const request = store.delete([annotation.metadata.id, frame]);

    return new Promise<void>((resolve, reject) => {
      request.onerror = (r) => reject(r);
      request.onsuccess = (r) => resolve(console.debug(r));
    });
  }

  getBoundedAnnotations(start: number, end: number) {
    return new Promise<VideoAnnotation[]>(async (resolve, reject) => {
      const transaction = this.db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations").index("end");
      const bound = IDBKeyRange.lowerBound(start);
      const request = store.openCursor(bound);

      const result: VideoAnnotation[] = [];
      request.onsuccess = (_) => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.shape.start <= end) {
            result.push(cursor.value);
          }

          cursor.continue();
        } else resolve(result);
      };
      request.onerror = (_) => {
        reject(request.error);
      };
    });
  }

  getAllIndex(key: string, value?: string) {
    return new Promise<VideoAnnotation[]>((resolve, reject) => {
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

  getAllStore(storename: string) {
    return new Promise<VideoAnnotation[]>((resolve, reject) => {
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

  getAllStartingWith(key: string, value: string) {
    return new Promise<VideoAnnotation[]>((resolve, reject) => {
      const transaction = this.db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations").index(key);
      const keyRange = IDBKeyRange.lowerBound(value);

      const request = store.openCursor(keyRange);

      const result: VideoAnnotation[] = [];
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

  interpolated_annotations(frame: number) {
    return new Promise<VideoAnnotation[]>((resolve, reject) => {
      const transaction = this.db.transaction(["annotations", "keyframes"]);

      const annotationsStore = transaction.objectStore("annotations").index("range");
      const keyFramesStore = transaction.objectStore("keyframes");

      const annotationsRange = IDBKeyRange.bound([0, frame], [frame, Infinity]);
      const annotationsRequest = annotationsStore.openCursor(annotationsRange);

      const result: VideoAnnotation[] = [];
      annotationsRequest.onsuccess = () => {
        const annotationsCursor = annotationsRequest.result;

        if (annotationsCursor) {
          const annotation = annotationsCursor.value;
          const keyFramePrevRange = IDBKeyRange.upperBound([annotation.metadata.id, frame]);
          const keyframePrevRequest = keyFramesStore.openCursor(keyFramePrevRange, "prev");

          const boundary: VideoFrameSelection[] = [];
          keyframePrevRequest.onsuccess = () => {
            const keyframePrevCursor = keyframePrevRequest.result;

            if (keyframePrevCursor) {
              if (keyframePrevCursor.value.annotation == annotation.metadata.id) {
                boundary[0] = keyframePrevCursor.value;

                const keyFrameNextRange = IDBKeyRange.lowerBound([annotation.metadata.id, frame]);
                const keyframeNextRequest = keyFramesStore.openCursor(keyFrameNextRange, "next");

                keyframeNextRequest.onsuccess = () => {
                  const keyFrameNextCursor = keyframeNextRequest.result;

                  if (keyFrameNextCursor) {
                    if (keyFrameNextCursor.value.annotation == annotation.metadata.id) {
                      boundary[1] = keyFrameNextCursor.value;
                    }
                  }

                  if (boundary[0] && boundary[1]) {
                    // interpolate from within bounds
                    if (boundary[0].frame === boundary[1].frame && boundary[0].frame == frame) {
                      result.push({
                        ...annotation,
                        shape: {
                          ...annotation.shape,
                          frames: [boundary[0]],
                        },
                      });
                    } else {
                      const ratio = (frame - boundary[0].frame) / (boundary[1].frame - boundary[0].frame);
                      annotation.shape.frames = [
                        {
                          frame,
                          points: boundary[1].points.map((point: Point, i: number) => [
                            // assume order
                            boundary[0].points[i][X] + (point[X] - boundary[0].points[i][X]) * ratio,
                            boundary[0].points[i][Y] + (point[Y] - boundary[0].points[i][Y]) * ratio,
                          ]),
                        },
                      ];
                      result.push(annotation);
                    }
                  }
                };
              }
              annotationsCursor.continue();
            }
          };
        }
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        resolve(result);
      };
    });
  }

  bounded_frames(start: number, end: number) {
    return new Promise<VideoAnnotation[]>((resolve, reject) => {
      const transaction = this.db.transaction(["annotations", "keyframes"]);

      const annotationsStore = transaction.objectStore("annotations").index("range");
      const keyFramesStore = transaction.objectStore("keyframes");

      const annotationsRange = IDBKeyRange.bound([0, start], [end, Infinity]);
      const annotationsRequest = annotationsStore.openCursor(annotationsRange);

      const result: VideoAnnotation[] = [];
      annotationsRequest.onsuccess = () => {
        const annotationsCursor = annotationsRequest.result;
        if (annotationsCursor) {
          const annotation = annotationsCursor.value;
          const keyFramePrevRange = IDBKeyRange.upperBound([annotation.metadata.id, start]);
          const keyframePrevRequest = keyFramesStore.openCursor(keyFramePrevRange, "prev");

          const boundary: VideoFrameSelection[] = [];
          keyframePrevRequest.onsuccess = () => {
            const keyframePrevCursor = keyframePrevRequest.result;

            if (keyframePrevCursor) {
              if (keyframePrevCursor.value.annotation == annotation.metadata.id) {
                boundary[0] = keyframePrevCursor.value;
              }
            }

            const keyFrameNextRange = IDBKeyRange.lowerBound([annotation.metadata.id, end]);
            const keyframeNextRequest = keyFramesStore.openCursor(keyFrameNextRange, "next");

            keyframeNextRequest.onsuccess = () => {
              const keyFrameNextCursor = keyframeNextRequest.result;

              if (keyFrameNextCursor) {
                if (keyFrameNextCursor.value.annotation == annotation.metadata.id) {
                  boundary[1] = keyFrameNextCursor.value;
                }
              }

              if (boundary.length) {
                const range = IDBKeyRange.bound(
                  [annotation.metadata.id, boundary[0].frame],
                  [annotation.metadata.id, boundary[1] ? boundary[1].frame : boundary[0].frame],
                );

                const response = keyFramesStore.getAll(range);

                response.onsuccess = () => {
                  annotation.shape = {
                    ...annotation.shape,
                    frames: response.result,
                  };
                  result.push(annotation);
                };

                response.onerror = () => {
                  reject(response.error);
                };
              }
            };
            annotationsCursor.continue();
          };
        }
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        resolve(result);
      };
    });
  }
}
