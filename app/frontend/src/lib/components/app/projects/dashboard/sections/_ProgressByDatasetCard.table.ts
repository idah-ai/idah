import DatasetNameCell from "@/components/app/projects/dashboard/sections/data-table-cells/_DatasetNameCell.svelte";
import DatasetProgressCell from "@/components/app/projects/dashboard/sections/data-table-cells/_DatasetProgressCell.svelte";
import DatasetAnnotationsCell from "@/components/app/projects/dashboard/sections/data-table-cells/_DatasetAnnotationsCell.svelte";
import DatasetDeliveryDateCell from "@/components/app/projects/dashboard/sections/data-table-cells/_DatasetDeliveryDateCell.svelte";
import DatasetDeliveryStatusBadgeCell from "@/components/app/projects/dashboard/sections/data-table-cells/_DatasetDeliveryStatusBadgeCell.svelte";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { DataTableColumnSettings } from "@/components/app/data-table/types";

export const columns: DataTableColumnSettings<DatasetRecord> = {
  dataset: {
    key: "name",
    title: "Dataset",
    cellComponent: DatasetNameCell,
  },
  entries: {
    key: "entries_total_count",
    title: "Entries",
    align: "right",
  },
  progress: {
    key: "progress",
    title: "Progress",
    cellComponent: DatasetProgressCell,
  },
  annotations: {
    key: "annotation_count",
    title: "Annotations",
    align: "right",
    cellComponent: DatasetAnnotationsCell,
  },
  delivery_date: {
    key: "formattedDeliveryDate",
    title: "Delivery date",
    cellComponent: DatasetDeliveryDateCell,
  },
  status: {
    key: "deliveryStatusBadge",
    title: "Delivery status",
    cellComponent: DatasetDeliveryStatusBadgeCell,
  },
};
