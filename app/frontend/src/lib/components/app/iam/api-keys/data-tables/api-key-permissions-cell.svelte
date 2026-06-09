<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";
  import { humanize } from "@/utils/string";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKeyRecord, contexts }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Types
  type Context = {
    permissions: Record<string, { title: string }>;
  };
  let { permissions }: Context = $derived(
    (contexts as Context) || {
      permissions: [],
    },
  );

  // Functions
  function getPermission(value: string): { title: string } | undefined {
    return permissions.find((permission) => permission.id == value)?.attributes;
  }
</script>

<div class="flex flex-col gap-1">
  {#each apiKeyRecord.permissions as permission, index (index)}
    <Badge variant="outline" rounded="full">
      {getPermission(permission)?.title || humanize(permission)}
    </Badge>
  {/each}
</div>
