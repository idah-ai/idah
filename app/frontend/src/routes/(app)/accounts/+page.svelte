<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { accountColumns } from "@/components/app/iam/accounts/data-tables/account-columns";
  import { accountBreadcrumb, homeBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  pageBreadcrumbsStore.set([homeBreadcrumb, accountBreadcrumb]);

  // Variables
  let canCreateAccount = $state(false);
  let canDeleteAccount = $state(false);
  let openNewAccountFormModal: boolean = $state(false);
  let columns = $state(accountColumns);

  // Lifecycle
  onMount(async () => {
    await checkRights();
  });

  // Functions
  async function checkRights() {
    canCreateAccount = (await $authStatus.authContext?.can("create", "iam:accounts")) || false;
    canDeleteAccount = (await $authStatus.authContext?.can("delete", "iam:accounts")) || false;
    columns.action.visible = canCreateAccount || canDeleteAccount;
  }

  function openNewAccountModal(): void {
    openNewAccountFormModal = true;
  }
</script>

{#snippet AddNewAccountButton()}
  <Can action="create" resource="iam:accounts" roles={"admin"}>
    <Button onclick={openNewAccountModal}>
      <PlusIcon />
      New Account
    </Button>

    <AccountFormModal action="create" title="Account" bind:open={openNewAccountFormModal} />
  </Can>
{/snippet}

<PageProvider name="accounts" roles={["admin", "org_owner"]} action="read" resource="iam:accounts">
  <PageHeader title="Accounts">
    {#snippet actions()}
      {@render AddNewAccountButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.accounts.list}
    <DatasourceTable
      id="accounts"
      name="account"
      refetchKey="accounts"
      {columns}
      dataSource={accountsBackendDataSource}
      listOptions={{
        fields: {
          [AccountRecord.type]: ["name", "email", "enabled", "role_name", "joined_at", "created_at", "updated_at"],
        },
        filters: {
          role_name__nin: ["system"],
        },
      }}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewAccountButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
