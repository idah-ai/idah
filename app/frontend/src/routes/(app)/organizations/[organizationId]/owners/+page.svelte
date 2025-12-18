<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import AddOrgOwnersButton from "@/components/app/organizations/buttons/add-org-owners-button.svelte";

  import { organizationOwnerColumns } from "@/components/app/organizations/data-tables/organization-owner-column";
  import { organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  // Contexts
  const organization: OrganizationRecord = getContext("organization");

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let canUpdateAccount = $state(false);
  let canDeleteAccount = $state(false);
  let columns = $state(organizationOwnerColumns);

  pageBreadcrumbsStore.set([
    organizationBreadcrumb,
    { label: organization.name, href: resolve(`/organizations/${organizationId}/owners`) },
    { label: "Owners" },
  ]);

  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    canUpdateAccount = (await currentAccount?.can("update", "iam:accounts")) || false;
    canDeleteAccount = (await currentAccount?.can("delete", "iam:accounts")) || false;
    columns.action.visible = canUpdateAccount && canDeleteAccount;
  });
</script>

{#key $refetches.accounts.list}
  <DatasourceTable
    id="organization-owners-{organizationId}"
    name="owner"
    refetchKey="accounts"
    {columns}
    dataSource={accountsBackendDataSource}
    listOptions={{
      filters: {
        with_role_scope: {
          org: [organizationId],
        },
        role_name__in: ["org_owner"],
      },
    }}
  >
    {#snippet addNewRecordButton()}
      <AddOrgOwnersButton />
    {/snippet}
  </DatasourceTable>
{/key}
