import FilterByProjectMemberWithUnassigned from "@/components/app/datasets/entries/data-tables/filters/filter-by-project-member-with-unassigned.svelte";

import { entryPriorities, entryStatuses, entryWorkflowSteps } from "@/data/model/dataset/entries/constants";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

export const entryColumns: ColumnsSettings<EntryRecord> = {
  resource: {
    label: "Name",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "name",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
  },
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
  assigned_to_id: {
    label: "Assigned to",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "assigned_to_email",
      filterKeys: ["assigned_to_email__match", "assigned"],
      filterBy: "datasource",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    filterComponent: FilterByProjectMemberWithUnassigned,
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
  created_at: {
    label: "Created at",
    dataType: "date",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: false,
    hidable: true,
  },
};
