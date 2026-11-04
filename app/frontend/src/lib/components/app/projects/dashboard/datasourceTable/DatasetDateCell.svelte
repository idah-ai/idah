<script lang="ts">
  import { datasetDeliveryDate, deliveryDate } from "@/components/app/projects/dashboard/DashboardStatus";
  import DateText from "@/components/app/texts/date-text.svelte";

  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  // Props
  let { record }: { record: DatasetRecord } = $props();
</script>

<span class="whitespace-nowrap"
  >{#if datasetDeliveryDate(record)}<DateText
      datetime={deliveryDate(datasetDeliveryDate(record))}
      datetimeFormat="MMM dd, yyyy"
      size="sm"
    />{:else}—{/if}</span
>
