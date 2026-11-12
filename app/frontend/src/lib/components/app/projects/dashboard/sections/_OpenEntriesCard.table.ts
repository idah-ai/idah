import { EntryRecord } from "@/data/model/dataset/entries/record";
import EntryNameCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryNameCell.svelte";
import EntryDatasetCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryDatasetCell.svelte";
import EntryStatusCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryStatusCell.svelte";
import EntryCurrentStageCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryCurrentStageCell.svelte";
import EntryAssignedToCell from "@/components/app/projects/dashboard/sections/data-table-cells/_EntryAssignedToCell.svelte";

import type { DataTableColumnSettings } from "@/components/app/data-table/types";

export function getColumns(overview: boolean): DataTableColumnSettings<EntryRecord> {
  return {
    entry: {
      key: "name",
      title: "Entry",
      cellComponent: EntryNameCell,
    },
    ...(overview
      ? {
          dataset: {
            key: "dataset",
            title: "Dataset",
            cellComponent: EntryDatasetCell,
          },
        }
      : {}),
    status: {
      key: "status",
      title: "Current status",
      cellComponent: EntryStatusCell,
    },
    stage: {
      key: "wf_step",
      title: "Current stage",
      cellComponent: EntryCurrentStageCell,
    },
    assigned_to: {
      key: "assigned_to",
      title: "Assigned to",
      cellComponent: EntryAssignedToCell,
    },
  };
}
