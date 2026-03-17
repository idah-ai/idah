import type { IConfigValue } from "$idah/context/ActivityContext";

export interface CategoryDefinition {
  id: string;
  name: string; // Name of the category
  description?: string; // Description of the category
  requiredNested?: boolean; // true = this category requires a subcategory
  nestedCategories?: CategoryDefinition[]; // Subcategories
  data: IConfigValue; // why dont we store the missing attributes from it in this interface directly ?
}
