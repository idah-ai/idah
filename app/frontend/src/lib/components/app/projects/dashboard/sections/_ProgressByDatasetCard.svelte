<script lang="ts">
  import * as Card from "$lib/components/ui/card/index";
  import DataTable from "@/components/app/data-table/DataTable.svelte";

  import type { DataTableColumnSettings, DataTableRows } from "@/components/app/data-table/types";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import DatasetNameCell from "./data-table-cells/_DatasetNameCell.svelte";

  const columns: DataTableColumnSettings<DatasetRecord> = {
    dataset: {
      key: "name",
      title: "Dataset",
      cellComponent: DatasetNameCell,
    },
    entries: {
      key: "entries",
      title: "Entries",
      align: "right",
    },
    progress: {
      key: "progress",
      title: "Progress",
    },
    annotations: {
      key: "annotation_count",
      title: "Annotations",
      align: "right",
    },
    delivery_date: {
      key: "delivery_date",
      title: "Delivery date",
    },
  };

  const rows: DataTableRows = [
    {
      name: "Video 1",
      entries: 160,
      progress: 1,
      annotation_count: 651,
      delivery_date: "2026-09-22",
    },
  ];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Progress by dataset</Card.Title>

    <Card.Action>
      <Card.Description>Click a dataset to view it on its own</Card.Description>
    </Card.Action>
  </Card.Header>

  <Card.Content>
    <DataTable {columns} {rows} caption="Showing the 8 longest waiting of 558" />
  </Card.Content>
</Card.Root>
