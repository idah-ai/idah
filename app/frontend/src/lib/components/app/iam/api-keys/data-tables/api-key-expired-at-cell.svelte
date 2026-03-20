<script lang="ts">
  import DateText from "@/components/app/texts/date-text.svelte";

  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKey }: DataTableCellBaseProps<ApiKeyRecord> = $props();

</script>

<DateText datetime={apiKey.expired_at} datetimeFormat="MMM dd, yyyy HH:mm:ss" size="sm" showTooltip></DateText>
