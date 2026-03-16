<script lang="ts">
  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();
</script>
