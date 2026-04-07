import {
  AnnotationsIndexedDB,
  openAnnotationsDB,
  type StoresDefinition,
} from "$lib/plugin/video-annotation-activity/indexedDB";
import type {
  VideoAnnotationObject,
  VideoFrameSelection,
} from "$lib/plugin/video-annotation-activity/context/video-annotation-context";

/**
 * Reactive middleware layer
 * Manages state and provides business logic on top of IndexedDB
 */
export class AnnotationsMiddleware {
  private db: AnnotationsIndexedDB;

  /**
   * Reactive annotations cache
   * This is the single source of truth for the UI
   */
  annotations = $state<VideoAnnotationObject[]>([]);

  constructor(db: AnnotationsIndexedDB) {
    this.db = db;
    this.loadAnnotations();
  }

  /**
   * Load all annotations from IndexedDB into reactive state
   */
  private async loadAnnotations() {
    const data = await this.db.getAll("annotations");
    this.annotations = data;
  }

  /**
   * Reload annotations from database
   * Call after any write operations
   */
  async reload() {
    await this.loadAnnotations();
  }

  /**
   * Get annotation by ID from cache
   */
  getById(id: string): VideoAnnotationObject | undefined {
    return this.annotations.find((ann) => ann.metadata.id === id);
  }

  /**
   * Get all annotations where category starts with value (for hierarchies)
   */
  annotationsForCategory(value: string): VideoAnnotationObject[] {
    return this.annotations.filter((ann) => ann.value.category?.startsWith(value));
  }

  /**
   * Get all annotations with exact category match
   */
  annotationsByCategory(categoryId: string): VideoAnnotationObject[] {
    return this.annotations.filter((ann) => ann.value.category === categoryId);
  }

  /**
   * Upsert multiple annotations
   */
  async upsertAnnotations(annotations: VideoAnnotationObject[]): Promise<void> {
    await this.db.putAnnotations(annotations);
    await this.reload();
  }

  /**
   * Delete an annotation
   */
  async deleteAnnotation(annotation_id: string): Promise<void> {
    await this.db.deleteAnnotation(annotation_id);
    await this.reload();
  }

  /**
   * Add a keyframe to an annotation
   */
  async addKeyFrame(annotation: VideoAnnotationObject, keyFrame: VideoFrameSelection): Promise<void> {
    await this.db.addKeyFrame(annotation.metadata.id, keyFrame);
    await this.reload();
  }

  /**
   * Delete a keyframe from an annotation
   */
  async deleteKeyFrame(annotation: VideoAnnotationObject, frame: number): Promise<void> {
    await this.db.deleteKeyFrame(annotation.metadata.id, frame);
    await this.reload();
  }

  /**
   * Get all annotations in a group
   */
  async getGroupAnnotations(groupId: string): Promise<VideoAnnotationObject[]> {
    return this.db.getGroupAnnotations(groupId);
  }

  /**
   * Get single annotation from database (not cache)
   */
  async get(store_name: string, key: string): Promise<VideoAnnotationObject> {
    return this.db.get(store_name, key);
  }

  /**
   * Get all annotations by index from database (not cache)
   */
  async getAllIndex(key: string, value?: string): Promise<VideoAnnotationObject[]> {
    return this.db.getAllByIndex(key, value);
  }

  /**
   * Update visibility for all annotations
   */
  async updateAllVisibility(hidden: boolean): Promise<void> {
    await this.db.updateAll((ann) => ({ ...ann, hidden }));
    await this.reload();
  }

  /**
   * Update lock state for all annotations
   */
  async updateAllLock(locked: boolean): Promise<void> {
    await this.db.updateAll((ann) => ({ ...ann, locked }));
    await this.reload();
  }

  /**
   * Get all items from store (for backward compatibility)
   */
  async getAllStore(storename: string): Promise<VideoAnnotationObject[]> {
    return this.db.getAll(storename);
  }
}

/**
 * Initialize IndexedDB and return middleware instance
 */
export async function annotationsIndexedDB(name: string, stores?: StoresDefinition) {
  const db = await openAnnotationsDB(name, stores);
  return new AnnotationsMiddleware(db);
}
