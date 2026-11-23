<script lang="ts">
  import { parseISO } from "date-fns";

  import DateText from "@/components/app/texts/date-text.svelte";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  interface Props {
    row: DatasetRecord;
  }
  let { row: dataset }: Props = $props();
</script>

{#if dataset.delivery_date}
  <DateText size="sm" dateOnly showTooltip datetime={parseISO(dataset.delivery_date)} datetimeFormat="MMM dd, yyyy" />
{:else}
  <span>-</span>
{/if}
