<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Variables
  let { scopeTypeLabel } = $derived(apiKeyRecord);
</script>

<Badge>
  {scopeTypeLabel}
</Badge>
