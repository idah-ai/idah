// V1 compatibility type - used by PropertySelector
export interface AnnotationValue extends Record<string, unknown> {
  category?: string;
  attributes?: Record<string, unknown>;
  label?: string;
  [key: string]: unknown;
}

export interface AnnotationGroup<T> {
  groupId: string;
  annotations: T[];
}
