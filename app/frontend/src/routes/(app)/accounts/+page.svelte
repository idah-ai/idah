<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { accountColumns } from "@/components/app/iam/accounts/data-tables/account-columns";

  import { refetches } from "@/utils/refetch";

  import { accountBreadcrumb, homeBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  pageBreadcrumbsStore.set([homeBreadcrumb, accountBreadcrumb]);

  // Variables
  let openNewAccountFormModal: boolean = $state(false);

  // Functions
  function openNewAccountModal(): void {
    openNewAccountFormModal = true;
  }
</script>

{#snippet AddNewAccountButton()}
  <Button onclick={openNewAccountModal}>
    <PlusIcon class="size-4"></PlusIcon>
    New Account
  </Button>
{/snippet}

<PageProvider name="accounts" roles={["admin", "org_owner"]}>
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
      columns={accountColumns}
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

<AccountFormModal action="create" title="Account" bind:open={openNewAccountFormModal} />
