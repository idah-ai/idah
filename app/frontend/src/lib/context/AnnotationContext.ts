export type AnnotationShape = {
  type: string;

  // Here it's open bar.
  // Based on the type of annotation, we can have very different properties.
}

export type AnnotationValue = {
  category?: string // follow format "category/subcategory"
  label?: string // if applicable, e.g. for text classification

  text?: string // used for text classification or descriptive annotations.

  source? : string // e.g. "user" or "model"
  confidence?: number // between 0 and 1, only if applicable

  tags?: string[] // a tag list, e.g. ["tag1", "tag2"]

  attributes?: Record<string, any> // Other attributes, e.g. {"key": "value"}
}

export type AnnotationMetadata = {
  id: string; // Unique identifier for the annotation

  createdAt: Date; // Timestamp of when the annotation was created
  updatedAt: Date; // Timestamp of when the annotation was last updated

  userId?: string; // ID of the user who created the annotation
  comments?: string[]; // Comments or notes associated with the annotation
}

/**
 * Represents an annotation object.
 */
export interface AnnotationObj<
  Shape extends AnnotationShape,
  Value extends AnnotationValue,
  Metadata extends AnnotationMetadata,
> {
  shape: Shape;
  value: Value;
  metadata: Metadata;
}

export type Annotation = AnnotationObj<AnnotationShape, AnnotationValue, AnnotationMetadata>;

/**
 * Contains methods for managing annotations.
 */
export interface AnnotationContext {
  /**
   * Lists annotations with pagination.
   * @param filter - Depending on the driver. Could be empty for image, returning all annotation,
   *                 or could load the annotation for specific frame range for example for video.
   * @returns A promise that resolves to an array of annotations.
   */
  listAnnotations(filter: Record<string, any>): Promise<Annotation[]>;

  /**
   * Adds a new annotation.
   * @param annotation - The annotation to add.
   * @returns A promise that resolves when the annotation is added.
   */
  addAnnotation(annotation: Annotation): Promise<void>;

  /**
   * Removes an annotation.
   * @param id - The ID of the annotation to remove.
   * @returns A promise that resolves when the annotation is removed.
   */
  removeAnnotation(id: string): Promise<void>;

  /**
   * Gets specific information about an annotation.
   * @param id - The ID of the annotation.
   * @returns A promise that resolves to the annotation object.
   */
  getAnnotationInfo(id: string): Promise<Annotation>;
}
