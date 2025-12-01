import { projectCreatedAtColumn, projectNameColumn } from "@/components/app/projects/datasource-tables/project-columns";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const organizationProjectColumns: ColumnsSettings<ProjectRecord> = {
  name: projectNameColumn,
  created_at: projectCreatedAtColumn,
};
