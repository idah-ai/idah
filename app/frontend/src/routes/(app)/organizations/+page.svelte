<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { accountColumns } from "@/components/app/iam/accounts/data-tables/account-columns";
  import { organizationBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";
  import { PlusIcon } from "@lucide/svelte";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Variables
  let breadcrumbs: PageBreadcrumbItem[] = $state([organizationBreadcrumb]);
  let openNewOrganizationFormModal: boolean = $state(false);

  // Functions
  function openNewOrganizationModal(): void {
    openNewOrganizationFormModal = true;
  }
</script>

{#snippet AddNewOrganizationButton()}
  <Button onclick={openNewOrganizationModal}>
    <PlusIcon class="size-4"></PlusIcon>
    New Organization
  </Button>
{/snippet}

<PageProvider name="organizations" {breadcrumbs}>
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
      columns={accountColumns}
      dataSource={accountsBackendDataSource}
      listOptions={{
        fields: {
          [AccountRecord.type]: ["name", "email", "enabled", "joined_at", "created_at", "updated_at"],
        },
      }}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewOrganizationButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>

<OrganizationFormModal action="create" title="Organization" bind:open={openNewOrganizationFormModal}
></OrganizationFormModal>
