<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationOwnersFormModal from "@/components/app/organizations/overlays/organization-owners-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { organizationOwnerColumns } from "@/components/app/organizations/data-tables/organization-owner-column";
  import { homeBreadcrumb, organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  // Contexts
  const organization: OrganizationRecord = getContext("organization");

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let openAddNewOrgOwnersModal: boolean = $state(false);

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    organizationBreadcrumb,
    { label: organization.name, href: resolve(`/organizations/${organizationId}/owners`) },
    { label: "Owners" },
  ]);

  // Functions
  function openAddNewOrgOwnersDialog() {
    openAddNewOrgOwnersModal = true;
  }
</script>

{#snippet AddNewOrgOwnersButton()}
  <Button onclick={openAddNewOrgOwnersDialog}>
    <PlusIcon />
    Add Owners
  </Button>
{/snippet}

{#key $refetches.projects.list}
  <DatasourceTable
    id="organization-owners-{organizationId}"
    name="owner"
    refetchKey="accounts"
    columns={organizationOwnerColumns}
    dataSource={accountsBackendDataSource}
    listOptions={{
      filters: {
        organization_id: organizationId,
        role_name__in: ["org_owner"],
      },
    }}
  >
    {#snippet actions()}
      {@render AddNewOrgOwnersButton()}
    {/snippet}

    {#snippet addNewRecordButton()}
      {@render AddNewOrgOwnersButton()}
    {/snippet}
  </DatasourceTable>
{/key}

<OrganizationOwnersFormModal title="Owners" action="create" bind:open={openAddNewOrgOwnersModal} />
