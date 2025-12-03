import FilterByProjectMember from "@/components/app/datasource-table/filters/filter-by-project-member.svelte";

import { entryPriorities, entryStatuses, entryWorkflowSteps } from "@/data/model/dataset/entries/constants";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

export const entryColumns: ColumnsSettings<EntryRecord> = {
  status: {
    label: "Status",
    dataType: "enum",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "status",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: entryStatuses,
    },
    visible: true,
    hidable: false,
  },
  priority: {
    label: "Priority",
    dataType: "enum",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "priority",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: entryPriorities,
    },
    visible: true,
    hidable: false,
  },
  assigned_to_member_id: {
    label: "Assigned to",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "assigned_to_member_id",
      filterBy: "datasource",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    filterComponent: FilterByProjectMember,
  },
  wf_step: {
    label: "Stage",
    dataType: "enum",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "wf_step",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: entryWorkflowSteps,
    },
    visible: true,
    hidable: false,
  },
};
