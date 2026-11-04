import NameCell from "@/components/app/projects/dashboard/datasourceTable/DatasetNameCell.svelte";
import StatusCell from "@/components/app/projects/dashboard/datasourceTable/DatasetStatusCell.svelte";
import TotalCell from "@/components/app/projects/dashboard/datasourceTable/DatasetTotalCell.svelte";
import PercentCell from "@/components/app/projects/dashboard/datasourceTable/DatasetPercentCell.svelte";
import DateCell from "@/components/app/projects/dashboard/datasourceTable/DatasetDateCell.svelte";
import DeliveryCell from "@/components/app/projects/dashboard/datasourceTable/DatasetDeliveryCell.svelte";

import { DatasetRecord } from "@/data/model/dataset/dataset-record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

const base = { visible: true, hidable: false, sortable: false, filterable: false };
export const datasetProgressColumns: ColumnsSettings<DatasetRecord> = {
  name: {
    ...base,
    label: "Dataset Name",
    dataType: "string",
    sortable: true,
    filterable: true,
    filterOptions: { filterKey: "name", filterBy: "string", filterOperation: "match" },
    cellComponent: NameCell,
  },
  total: { ...base, label: "Total Entries", dataType: "number", cellComponent: TotalCell },
  status: { ...base, label: "Status", dataType: "string", cellComponent: StatusCell },
  progress: { ...base, label: "Progress", dataType: "number", cellComponent: PercentCell },
  delivery_date: { ...base, label: "Delivery Date", dataType: "date", cellComponent: DateCell },
  delivery: { ...base, label: "Delivery Status", dataType: "string", cellComponent: DeliveryCell },
};
