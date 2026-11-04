import NameCell from "@/components/app/projects/dashboard/datasourceTable/OpenEntryNameCell.svelte";
import StatusCell from "@/components/app/projects/dashboard/datasourceTable/OpenEntryStatusCell.svelte";
import AssigneeCell from "@/components/app/projects/dashboard/datasourceTable/OpenEntryAssigneeCell.svelte";
import TimeCell from "@/components/app/projects/dashboard/datasourceTable/OpenEntryTimeCell.svelte";
import DatasetCell from "@/components/app/projects/dashboard/datasourceTable/OpenEntryDatasetCell.svelte";

import { EntryRecord } from "@/data/model/dataset/entries/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

const base = { sortable: false, filterable: false, visible: true, hidable: false };

export const openEntryColumns: ColumnsSettings<EntryRecord> = {
  name: { ...base, label: "Entry", dataType: "string", cellComponent: NameCell },
  dataset_id: { ...base, label: "Dataset", dataType: "string", cellComponent: DatasetCell },
  status: { ...base, label: "Status", dataType: "string", cellComponent: StatusCell },
  wf_step: { ...base, label: "Stage", dataType: "string" },
  assigned_to_id: { ...base, label: "Assigned to", dataType: "string", cellComponent: AssigneeCell },
  in_status: { ...base, label: "In status", dataType: "string", cellComponent: TimeCell },
};
