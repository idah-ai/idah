import { EntryRecord } from "@/data/model/dataset/entries/record";
import NameCell from "@/components/app/projects/dashboard/table/OpenEntryNameCell.svelte";
import DatasetCell from "@/components/app/projects/dashboard/table/OpenEntryDatasetCell.svelte";
import StatusCell from "@/components/app/projects/dashboard/table/OpenEntryStatusCell.svelte";
import StageCell from "@/components/app/projects/dashboard/table/OpenEntryStageCell.svelte";
import AssigneeCell from "@/components/app/projects/dashboard/table/OpenEntryAssigneeCell.svelte";
import TotalTimeCell from "@/components/app/projects/dashboard/table/OpenEntryTotalTimeCell.svelte";

import type { Component } from "svelte";

export interface OpenEntryColumn {
  id: "entry" | "dataset" | "status" | "stage" | "assignee" | "time";
  label: string;
  class?: string;
  cellClass?: string;
  overviewOnly?: boolean;
  cell: Component<{ record: EntryRecord; contexts?: { datasetNames?: { [id: string]: string } } }>;
}

const columns: OpenEntryColumn[] = [
  {
    id: "entry",
    label: "Entry",
    class: "pl-0",
    cellClass: "max-w-80 py-2 pl-0 [overflow-wrap:anywhere]",
    cell: NameCell,
  },
  {
    id: "dataset",
    label: "Dataset",
    overviewOnly: true,
    cellClass: "max-w-64 [overflow-wrap:anywhere]",
    cell: DatasetCell,
  },
  { id: "status", label: "Current status", cell: StatusCell },
  { id: "stage", label: "Current stage", cellClass: "text-xs", cell: StageCell },
  { id: "assignee", label: "Assigned to", cellClass: "max-w-64 [overflow-wrap:anywhere]", cell: AssigneeCell },
  {
    id: "time",
    label: "Total time spent",
    class: "pr-0 text-right",
    cellClass: "text-muted-foreground pr-0 text-right tabular-nums",
    cell: TotalTimeCell,
  },
];

export function openEntryColumns(combined: boolean): OpenEntryColumn[] {
  return columns.filter((column) => combined || !column.overviewOnly);
}
