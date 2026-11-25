<script lang="ts">
  import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";
  import { maskedSecret } from "@/data/model/setting/storage_target/utils";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();
</script>

<div class="flex flex-col">
  <span class="font-mono text-sm">{target.access_key_id}</span>
  <span class="text-muted-foreground font-mono text-xs">{maskedSecret(target.secret_hint)}</span>
</div>
