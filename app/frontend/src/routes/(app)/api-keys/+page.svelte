<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import APIKeyFormModal from "@/components/app/iam/api-keys/overlays/api-key-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { apiKeyColumns } from "@/components/app/iam/api-keys/data-tables/api-key-columns";
  import { apiKeyBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { Record } from "@/data/model/Record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";
  
  import type { Hash } from "@/utils/types";


  pageBreadcrumbsStore.set([apiKeyBreadcrumb]);

  // Variables
  let canCreateApiKey = $state(false);
  let canDeleteApiKey = $state(false);
  let columns = $state(apiKeyColumns);
  let openNewAPIKeyFormModal: boolean = $state(false);

  // Lifecycle
  onMount(async () => {
    await checkRights();
  });

  // Functions
  async function checkRights() {
    canCreateApiKey = (await $authStatus.authContext?.can("create", "iam:accounts")) || false;
    canDeleteApiKey = (await $authStatus.authContext?.can("delete", "iam:accounts")) || false;
    columns.action.visible = canCreateApiKey || canDeleteApiKey;
  }

  function openNewAPIKeyModal(): void {
    openNewAPIKeyFormModal = true;
  }

 async function onLoadSetContexts(): Promise<Hash> {
    const permissionsRes = await apiKeysBackendDataSource.permission_list({ scope_type: "all" });

    return { permissions: permissionsRes.data };
  }

</script>

{#snippet AddNewAPIKeyButton()}
  <Can action="create" resource="iam:api_keys">
    <Button onclick={openNewAPIKeyModal}>
      <PlusIcon />
      New API Key
    </Button>

    <APIKeyFormModal action="create" title="API Key" bind:open={openNewAPIKeyFormModal} />
  </Can>
{/snippet}

<PageProvider name="apiKeys" roles={["admin", "org_owner"]} action="read" resource="iam:accounts">
  <PageHeader title="API Keys">
    {#snippet actions()}
      {@render AddNewAPIKeyButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.apiKeys.list}
    <DatasourceTable
      id="api-keys"
      name="API Key"
      refetchKey="apiKeys"
      {columns}
      dataSource={apiKeysBackendDataSource}
      listOptions={{
        fields: {
          [ApiKeyRecord.type]: [
            "id",
            "name",
            "key_label",
            "key_sha",
            "scope_type",
            "permissions",
            "last_used_at",
            "created_at",
            "expires_at",
            "updated_at",
            "status"
          ],
        },
      }}
      {onLoadSetContexts}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewAPIKeyButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
