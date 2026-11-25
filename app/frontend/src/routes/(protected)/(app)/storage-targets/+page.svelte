<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import StorageTargetFormModal from "@/components/app/storage-targets/overlays/storage-target-form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { storageTargetBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { storageTargetColumns } from "@/components/app/storage-targets/data-tables/storage-target-columns";
  import { storageTargetsBackendDataSource } from "@/data/model/setting/storage_target/record";
  import { refetches } from "@/utils/refetch";

  pageBreadcrumbsStore.set([storageTargetBreadcrumb]);

  // Variables
  let openNewTargetModal: boolean = $state(false);
</script>

{#snippet AddNewTargetButton()}
  <Can action="create" resource="setting:storage_targets">
    <Button onclick={() => (openNewTargetModal = true)}>
      <PlusIcon />
      New Storage Target
    </Button>
  </Can>
{/snippet}

<PageProvider name="storageTargets" roles={["admin"]} action="read" resource="setting:storage_targets">
  <PageHeader
    title="Storage Targets"
    description="Dedicated S3 buckets for projects whose files must be kept apart. A project's storage is chosen when it is created and never changes."
  >
    {#snippet actions()}
      {@render AddNewTargetButton()}
    {/snippet}
  </PageHeader>

  {#key $refetches.storageTargets.list}
    <DatasourceTable
      id="storage-targets"
      name="Storage Target"
      refetchKey="storageTargets"
      columns={storageTargetColumns}
      dataSource={storageTargetsBackendDataSource}
    >
      {#snippet addNewRecordButton()}
        {@render AddNewTargetButton()}
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>

<StorageTargetFormModal action="create" title="Storage Target" bind:open={openNewTargetModal} />
