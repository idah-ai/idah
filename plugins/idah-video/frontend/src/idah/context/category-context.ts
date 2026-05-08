import type { IConfigValue } from "$idah/v2/types";

export type CategoryDefinition = IConfigValue & {
  id: string;
  name: string;
  description?: string;
  requiredNested?: boolean;
  nestedCategories?: CategoryDefinition[];
  isExpanded?: boolean;
  count?: number;
  data?: IConfigValue;
};
