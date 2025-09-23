//test
export async function openIndexedDB(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const DBOpenRequest = indexedDB.open(name, 4);
    DBOpenRequest.onerror = (event) => {
      reject(console.error("Error loading database."));
    };

    DBOpenRequest.onsuccess = (event) => {
      console.info("Database initialized.");
      resolve(DBOpenRequest.result);
    };

    DBOpenRequest.onupgradeneeded = (event) => {
      const annotationsStore = DBOpenRequest.result.createObjectStore("annotations");
      console.info("upgrade Database.");
      annotationsStore.createIndex("start", "shape.start", { unique: false });
      annotationsStore.createIndex("end", "shape.end", { unique: false });
      annotationsStore.createIndex("type", "shape.type", { unique: false });

      annotationsStore.createIndex("category", "value.category", { unique: false });
      annotationsStore.createIndex("label", "value.label", { unique: false, multiEntry: true });
      annotationsStore.createIndex("tags", "value.tags", { unique: false, multiEntry: true });

      annotationsStore.createIndex("updated_at", "metadata.updatedAt", { unique: false });
      annotationsStore.createIndex("created_at", "metadata.createdAt", { unique: false });

      const keyframesStore = DBOpenRequest.result.createObjectStore("keyframes", { autoIncrement: true });
      keyframesStore.createIndex("annotation", "annotation", { unique: false });
      //   keyframesStore.createIndex("annotation_frame", ["annotation", "frame"], { unique: true });
      //   keyframesStore.createIndex("annotation_frame", ["annotation", "frame"], { unique: true });
      keyframesStore.createIndex("frame", "frame", { unique: false });
      keyframesStore.createIndex("points", "points", { unique: false });
    };
  });
}
