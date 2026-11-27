<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();
</script>

{#if target.enabled}
  <Badge variant="success">Enabled</Badge>
{:else}
  <Badge variant="gray">Disabled</Badge>
{/if}
