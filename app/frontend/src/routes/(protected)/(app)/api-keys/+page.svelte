<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import APIKeyFormModal from "@/components/app/iam/api-keys/overlays/api-key-form-modal.svelte";
  import ApiKeyGeneratedModal from "@/components/app/iam/api-keys/overlays/api-key-generated-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { apiKeyColumns } from "@/components/app/iam/api-keys/data-tables/api-key-columns";
  import { apiKeyBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { ApiKeyRecord, apiKeysBackendDataSource } from "@/data/model/iam/api-keys/record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { Record } from "@/data/model/Record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import type { CollectionResponse } from "@/data/model/types";

  pageBreadcrumbsStore.set([apiKeyBreadcrumb]);

  // Variables
  let canCreateApiKey = $state(false);
  let canDeleteApiKey = $state(false);
  let columns = $state(apiKeyColumns);
  let openNewAPIKeyFormModal: boolean = $state(false);

  let openApiKeyGenerateFormModal: boolean = $state(false);
  let keyValue: string = $state("");

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

  async function onLoadSetContexts<T extends Record = ApiKeyRecord>(response: CollectionResponse<T>) {
    const scopeValues = Array.from(new Set(response.data.map((key) => key.scope_value)));

    const [allPermissionRes, orgPermissionRes, projectPermissionRes] = await Promise.all([
      apiKeysBackendDataSource.permission_list({ scope_type: "all" }),
      apiKeysBackendDataSource.permission_list({ scope_type: "org" }),
      apiKeysBackendDataSource.permission_list({ scope_type: "project" }),
    ]);

    const organizationRes = await organizationsBackendDataSource.list({
      fields: {
        [OrganizationRecord.type]: ["name"],
      },
      filters: {
        id__in: scopeValues,
      },
    });

    const projectRes = await projectsBackendDataSource.list({
      fields: {
        [ProjectRecord.type]: ["name"],
      },
      filters: {
        id__in: scopeValues,
      },
    });

    return {
      permissions: [...allPermissionRes.data, ...orgPermissionRes.data, ...projectPermissionRes.data],
      organizations: [...organizationRes.data],
      projects: [...projectRes.data],
    };
  }

  function openApiKeyGeneratedModal(apiKey: string): void {
    keyValue = apiKey;
    openApiKeyGenerateFormModal = true;
  }
</script>

{#snippet AddNewAPIKeyButton()}
  <Can action="create" resource="iam:api_keys">
    <Button onclick={openNewAPIKeyModal}>
      <PlusIcon />
      New API Key
    </Button>

    <APIKeyFormModal
      action="create"
      title="API Key"
      onCreatedApiKey={openApiKeyGeneratedModal}
      bind:open={openNewAPIKeyFormModal}
    />
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
            "scope_type",
            "scope_value",
            "permissions",
            "last_used_at",
            "created_at",
            "expires_at",
            "updated_at",
            "status",
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

<ApiKeyGeneratedModal value={keyValue} bind:open={openApiKeyGenerateFormModal} />
