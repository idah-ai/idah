<script lang="ts">
  import { Badge } from "@/components/ui/badge";
  import { isOverdue } from "@/utils/date";
  import { parseISO } from "date-fns";

  import DateText from "@/components/app/texts/date-text.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: dataset }: DataTableCellBaseProps<DatasetRecord> = $props();
  let { delivery_date } = $derived(dataset);
  let overdue = $derived(dataset.status !== "completed" && isOverdue(delivery_date));
</script>

<div class="flex flex-col items-center gap-2">
  {#if delivery_date}
    <DateText size="sm" showTooltip datetime={parseISO(delivery_date)} datetimeFormat="MMM dd, yyyy" />
  {:else}
    <span>—</span>
  {/if}
  {#if overdue}<Badge variant="destructive">Overdue</Badge>{/if}
</div>
