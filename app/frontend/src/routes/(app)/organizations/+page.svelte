<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { organizationColumns } from "@/components/app/organizations/data-tables/organization-columns";
  import { homeBreadcrumb, organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";
  import { PlusIcon } from "@lucide/svelte";

  pageBreadcrumbsStore.set([homeBreadcrumb, organizationBreadcrumb]);

  // Variables
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

<PageProvider name="organizations">
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
      columns={organizationColumns}
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

<OrganizationFormModal action="create" title="Organization" bind:open={openNewOrganizationFormModal}
></OrganizationFormModal>
