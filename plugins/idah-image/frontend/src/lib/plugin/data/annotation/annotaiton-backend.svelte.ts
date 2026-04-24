import {
  openAnnotationsDB,
  type AnnotationsIndexedDB,
  type StoresDefinition,
} from "$lib/plugin/data/annotation/annotation-db";

import type { ImageAnnotationObject, ImageFrameSelection } from "$lib/context/image-annotation-context";

/**
 * Reactive middleware layer
 * Manages state and provides business logic on top of IndexedDB
 */
export class AnnotationBackend {
  private db: AnnotationsIndexedDB;

  /**
   * Reactive annotations cache
   * This is the single source of truth for the UI
   *
   * TODO: IMPLEMENT PAGINATION FOR LARGE DATASETS
   * ===============================================
   *
   * Current Implementation:
   * - Loads ALL annotations into memory at once
   * - Works fine for small datasets (< 10,000 annotations)
   * - MEMORY ISSUE: Large datasets (100K+ annotations) can consume 500MB - 1GB+
   * - CRITICAL ISSUE: Bitmask annotations (1 bit per pixel) can be 1MB each = GB of memory!
   *
   * Pagination Strategy - Load Only Visible Annotations:
   *
   * 1. TIMELINE-BASED WINDOWING:
   *    - Only load annotations within visible timeline range
   *    - Example: If viewing frames 1000-2000, load annotations that overlap this range
   *    - Use IndexedDB range queries on 'start' and 'end' indexes
   *
   *    Implementation:
   *    ```typescript
   *    private visibleFrameRange = $state({ start: 0, end: 1000 });
   *
   *    async updateVisibleRange(startFrame: number, endFrame: number) {
   *      this.visibleFrameRange = { start: startFrame, end: endFrame };
   *      await this.loadVisibleAnnotations();
   *    }
   *
   *    private async loadVisibleAnnotations() {
   *      // Load annotations that overlap visible range
   *      // annotation.start <= visibleEnd && annotation.end >= visibleStart
   *      const data = await this.db.getAnnotationsInRange(
   *        this.visibleFrameRange.start,
   *        this.visibleFrameRange.end
   *      );
   *      this.annotations = data;
   *    }
   *    ```
   *
   * 2. BUFFER ZONES:
   *    - Load slightly more than visible range for smooth scrolling
   *    - Example: Visible range 1000-2000, load 900-2100 (100 frame buffer)
   *    - Prevents loading on every small scroll
   *
   * 3. VIRTUAL SCROLLING FOR SIDEBAR:
   *    - Don't render all annotation items in DOM
   *    - Only render visible items in sidebar viewport
   *    - Use libraries like svelte-virtual-list or custom implementation
   *
   * 4. LAZY FRAME DATA LOADING:
   *    - Load annotation metadata immediately (id, category, start, end)
   *    - Load frame data (points, geometries) only when annotation is selected
   *    - Store bitmasks separately, never load into memory
   *
   *    Example:
   *    ```typescript
   *    // Lightweight metadata
   *    type AnnotationMetadata = {
   *      id: string;
   *      category: string;
   *      start: number;
   *      end: number;
   *      type: string;
   *      frameCount: number; // Not the actual frames!
   *    };
   *
   *    // Load full data on-demand
   *    async getFullAnnotation(id: string): Promise<VideoAnnotationObject> {
   *      return this.db.get("annotations", id);
   *    }
   *    ```
   *
   * 5. PROGRESSIVE LOADING:
   *    - Initial load: Load first 1000 annotations or visible range
   *    - Background load: Load remaining annotations in chunks
   *    - Show loading indicator while fetching
   *
   * 6. MEMORY LIMITS:
   *    - Set max cache size (e.g., 5000 annotations max in memory)
   *    - Use LRU (Least Recently Used) eviction when limit reached
   *    - Always keep visible range + selected annotations in cache
   *
   * 7. INDEXEDDB OPTIMIZATION:
   *    - Add compound index: [start, end] for efficient range queries
   *    - Use cursor-based pagination for very large datasets
   *    - Implement count queries for showing totals without loading data
   *
   * When to Implement:
   * - Dataset > 10,000 annotations
   * - Video > 1 hour (at 30fps = 108K potential frames)
   * - Bitmask annotations (prevent loading pixel data)
   * - Browser memory warnings
   *
   * Memory Savings Example:
   * - 100,000 bounding boxes: 500MB → 50MB (load 10% visible range)
   * - 10,000 bitmask annotations: 10GB → 100MB (metadata only + visible)
   */
  annotations = $state<ImageAnnotationObject[]>([]);

  // TODO: Add pagination state
  // private visibleFrameRange = $state({ start: 0, end: 1000 });
  // private timelineWindow = $state({ zoom: 1, offset: 0 });

  constructor(db: AnnotationsIndexedDB) {
    this.db = db;
    this.loadAnnotations();
  }

  /**
   * Load all annotations from IndexedDB into reactive state
   * Sorted by creation date (ascending) for consistent ordering
   *
   * TODO: Replace with loadVisibleAnnotations()
   * - Accept frame range parameters (startFrame, endFrame)
   * - Query only annotations overlapping this range
   * - Add buffer zones for smooth scrolling
   * - Implement debouncing to prevent excessive queries
   */
  private async loadAnnotations() {
    const data = await this.db.getAll("annotations");
    this.annotations = data;

    // TODO: Pagination implementation
    // const data = await this.db.getAnnotationsInRange(
    //   this.visibleFrameRange.start - BUFFER_SIZE,
    //   this.visibleFrameRange.end + BUFFER_SIZE
    // );
    // this.annotations = data;
  }

  // TODO: Add method to update visible range
  // /**
  //  * Update visible frame range and reload annotations
  //  * Call this when:
  //  * - User scrolls timeline
  //  * - User zooms in/out
  //  * - Video seeks to different position
  //  */
  // async updateVisibleRange(startFrame: number, endFrame: number) {
  //   // Only reload if range changed significantly (debouncing)
  //   const changeThreshold = (endFrame - startFrame) * 0.25;
  //   if (
  //     Math.abs(this.visibleFrameRange.start - startFrame) > changeThreshold ||
  //     Math.abs(this.visibleFrameRange.end - endFrame) > changeThreshold
  //   ) {
  //     this.visibleFrameRange = { start: startFrame, end: endFrame };
  //     await this.loadAnnotations();
  //   }
  // }

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
  getById(id: string): ImageAnnotationObject | undefined {
    return this.annotations.find((ann) => ann.metadata.id === id);
  }

  /**
   * Get all annotations where category starts with value (for hierarchies)
   */
  annotationsForCategory(value: string): ImageAnnotationObject[] {
    return this.annotations.filter((ann) => ann.value.category?.startsWith(value));
  }

  /**
   * Get all annotations with exact category match
   */
  annotationsByCategory(categoryId: string): ImageAnnotationObject[] {
    return this.annotations.filter((ann) => ann.value.category === categoryId);
  }

  /**
   * Upsert multiple annotations
   */
  async upsertAnnotations(annotations: ImageAnnotationObject[]): Promise<void> {
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
   * Get all annotations in a group
   */
  async getGroupAnnotations(groupId: string): Promise<ImageAnnotationObject[]> {
    return this.db.getGroupAnnotations(groupId);
  }

  /**
   * Get single annotation from database (not cache)
   */
  async get(store_name: string, key: string): Promise<ImageAnnotationObject> {
    return this.db.get(store_name, key);
  }

  /**
   * Get all annotations by index from database (not cache)
   */
  async getAllIndex(key: string, value?: string): Promise<ImageAnnotationObject[]> {
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
  async getAllStore(storename: string): Promise<ImageAnnotationObject[]> {
    return this.db.getAll(storename);
  }
}

/**
 * Initialize IndexedDB and return middleware instance
 */
export async function annotationsIndexedDB(name: string, stores?: StoresDefinition) {
  const db = await openAnnotationsDB(name, stores);
  return new AnnotationBackend(db);
}
