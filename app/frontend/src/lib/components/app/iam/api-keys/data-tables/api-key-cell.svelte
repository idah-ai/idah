<script lang="ts">
  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Variables
  let { api_key } = $derived(apiKeyRecord);
</script>
