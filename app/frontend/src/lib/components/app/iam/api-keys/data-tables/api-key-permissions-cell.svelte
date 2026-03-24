<script lang="ts">
  import { Badge } from "@/components/ui/badge";

  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: apiKeyRecord }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Functions
  async function getPermissionTitle(permissionId: string): Promise<string> {
    const permissionsRes = await apiKeysBackendDataSource.permission_list();

    return (
      permissionsRes.data.filter((permission) => permission.id === permissionId)[0]?.attributes.title || permissionId
    );
  }
</script>

<div class="flex flex-col gap-1">
  {#each apiKeyRecord.permissions as permission}
    {#await getPermissionTitle(permission) then title}
      <Badge variant="outline" rounded="full">
        {title}
      </Badge>
    {/await}
  {/each}
</div>
