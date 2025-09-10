<script lang="ts">
  import AccountFormModal from "@/components/app/iam/accounts/overlays/account-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DataTable from "@/components/app/data-table/data-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";

  import { accountBreadcrumb } from "@/components/app/page/page-breadcrumb.constants";
  import { accountColumns } from "@/components/app/iam/accounts/data-tables/account-columns";
  import { PlusIcon } from "@lucide/svelte";
  import { refetches } from "@/utils/refetch";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";

  import type { PageBreadcrumbItem } from "@/components/app/page/page-breadcrumb.svelte";

  // Variables
  let breadcrumbs: PageBreadcrumbItem[] = $state([accountBreadcrumb]);
  let openNewAccountFormModal: boolean = $state(false);

  // Functions
  function openNewAccountModal(): void {
    openNewAccountFormModal = true;
  }
</script>

<PageProvider name="accounts" {breadcrumbs}>
  <PageHeader title="Accounts">
    {#snippet actions()}
      <Button onclick={openNewAccountModal}>
        <PlusIcon class="size-4" />
        New Account
      </Button>
    {/snippet}
  </PageHeader>

  {#key $refetches.accounts.list}
    <DataTable
      id="accounts"
      name="account"
      columns={accountColumns}
      dataSource={accountsBackendDataSource}
      listOptions={{
        fields: {
          [AccountRecord.type]: ["name", "email", "enabled", "joined_at", "created_at", "updated_at"],
        },
      }}
      onNewRecord={openNewAccountModal}
    ></DataTable>
  {/key}
</PageProvider>

<AccountFormModal action="create" title="Account" bind:open={openNewAccountFormModal}></AccountFormModal>
