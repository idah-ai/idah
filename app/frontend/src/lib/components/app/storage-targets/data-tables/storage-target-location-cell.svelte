<script lang="ts">
  import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";
  import { storageTargetLocation } from "@/data/model/setting/storage_target/utils";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();
</script>

<div class="flex flex-col">
  <span class="font-mono text-sm">{storageTargetLocation(target)}</span>
  <span class="text-muted-foreground text-xs">
    {target.endpoint}{target.region ? ` · ${target.region}` : ""}
  </span>
</div>
