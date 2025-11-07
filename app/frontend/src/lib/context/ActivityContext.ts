import type { IConfigValue } from "@/plugin/interface/Activity";
import type { AnnotationContext } from "./AnnotationContext";

/*
  The list of media objects related to this activity,
  within context of the key and with possible metadata.
*/
export type MediaInfo = {
  [key: string]: {
    url: string;
    metadata: Record<string, any>;
  };
};

export interface CategoryDefinition {
  id: string;
  name: string; // Name of the category
  description?: string; // Description of the category
  requiredNested?: boolean; // true = this category requires a subcategory
  nestedCategories?: CategoryDefinition[]; // Subcategories
  data: IConfigValue; // why dont we store the missing attributes from it in this interface directly ?
}
/**
 * Represents a category with its subcategories
 */
export type CategoriesDefinition = {
  [name: string]: CategoryDefinition[];
};

/**
 * Defines which fields of AnnotationValue are allowed for a specific annotation type
 */
export type AllowedValueFields = {
  categories?: CategoriesDefinition; // true = any category allowed, or specific categories/subcategories
  label?: boolean; // true = labels are allowed
  text?: boolean; // true = text is allowed
  confidence?: boolean; // true = confidence values are allowed
  tags?: boolean | string[]; // true = any tags allowed, or specific allowed tags
  attributes?: boolean | string[]; // true = any attributes allowed, or list of allowed attribute keys
};

/**
 * Describes the allowed type of annotation for this activity
 */
export type ToolInfo = {
  [annotationType: string]: {
    // Shape-specific configuration
    shapeConfig?: Record<string, any>; // Additional configuration for the shape type

    // Allowed value fields
    allowedFields: AllowedValueFields;

    // Required value fields
    requiredFields?: string[];
  };
};

/**
 * Describes everything related to an activity
 */
export type ActivityContext = {
  mode: string; // edit, read-only, qc. Related to the activity itself and the current step in the workflow

  // Informations related to the media we are annotation
  medias: MediaInfo;

  // Configuration for allowed annotation tools & rules
  tools: ToolInfo;

  // Driver for updating annotations
  annotationContext: AnnotationContext;
};
