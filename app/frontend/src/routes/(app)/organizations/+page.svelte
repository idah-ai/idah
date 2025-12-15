<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { organizationColumns } from "@/components/app/organizations/data-tables/organization-columns";
  import { organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  pageBreadcrumbsStore.set([organizationBreadcrumb]);

  // Variables
  let currentAccount = $authStatus.authContext;
  let openNewOrganizationFormModal: boolean = $state(false);
  let columns = $state(organizationColumns);
  let canUpdateOrganization = $state(false);
  let canDeleteOrganization = $state(false);

  // Functions
  function openNewOrganizationModal(): void {
    openNewOrganizationFormModal = true;
  }

  onMount(async () => {
    canUpdateOrganization = (await currentAccount?.can("update", "iam:organizations")) || false;
    canDeleteOrganization = (await currentAccount?.can("delete", "iam:organizations")) || false;
    columns.action.visible = canUpdateOrganization || canDeleteOrganization;
  });
</script>

{#snippet AddNewOrganizationButton()}
  <Can action="create" resource="iam:organizations">
    <Button onclick={openNewOrganizationModal}>
      <PlusIcon />
      New Organization
    </Button>

    <OrganizationFormModal action="create" title="Organization" bind:open={openNewOrganizationFormModal} />
  </Can>
{/snippet}

<PageProvider name="organizations" roles={["admin", "org_owner"]} action="read" resource="iam:organizations">
  <PageHeader title="Organizations">
    {#snippet actions()}
      {@render AddNewOrganizationButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.organizations.list}
    <DatasourceTable
      id="organizations"
      name="organizations"
      refetchKey="organizations"
      {columns}
      dataSource={organizationsBackendDataSource}
      listOptions={{
        fields: {
          [OrganizationRecord.type]: ["name", "created_at"],
        },
      }}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewOrganizationButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
