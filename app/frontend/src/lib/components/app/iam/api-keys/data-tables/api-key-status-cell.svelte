<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();
</script>

<Badge variant={apiKeyRecord.statusBadge.variant}>
  {apiKeyRecord.statusBadge.label}
</Badge>
