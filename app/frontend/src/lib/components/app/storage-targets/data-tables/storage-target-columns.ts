import StorageTargetLocationCell from "@/components/app/storage-targets/data-tables/storage-target-location-cell.svelte";
import StorageTargetOrganizationsCell from "@/components/app/storage-targets/data-tables/storage-target-organizations-cell.svelte";
import StorageTargetRowActionCell from "@/components/app/storage-targets/data-tables/storage-target-row-action-cell.svelte";
import StorageTargetSecretCell from "@/components/app/storage-targets/data-tables/storage-target-secret-cell.svelte";
import StorageTargetStatusCell from "@/components/app/storage-targets/data-tables/storage-target-status-cell.svelte";

import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const storageTargetColumns: ColumnsSettings<StorageTargetRecord> = {
  name: {
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
  bucket: {
    label: "Location",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: StorageTargetLocationCell,
  },
  access_key_id: {
    label: "Credentials",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: true,
    cellComponent: StorageTargetSecretCell,
  },
  organization_ids: {
    label: "Organizations",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: StorageTargetOrganizationsCell,
  },
  enabled: {
    label: "Status",
    dataType: "boolean",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "enabled",
      filterBy: "boolean",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: StorageTargetStatusCell,
  },
  created_at: {
    label: "Created At",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: true,
  },
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: StorageTargetRowActionCell,
  },
};
