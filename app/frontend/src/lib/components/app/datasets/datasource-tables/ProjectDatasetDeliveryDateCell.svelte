<script lang="ts">
  import DateText from "@/components/app/texts/date-text.svelte";
  
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
  let { delivery_date } = $derived(dataset);
</script>

{#if delivery_date}
  <DateText size="sm" showTooltip datetime={new Date(delivery_date) as Date} datetimeFormat="MMM dd, yyyy" />
{:else}
  <span>—</span>
{/if}
