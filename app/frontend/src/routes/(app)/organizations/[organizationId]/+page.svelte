<script lang="ts">
  import { page } from "$app/state";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { organizationColumns } from "@/components/app/organizations/data-tables/organization-columns";
  import { homeBreadcrumb, organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { refetches } from "@/utils/refetch";
  import { Edit2Icon } from "@lucide/svelte";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/dataset/organizations/record";

  // Records
  let organization: OrganizationRecord = $state(new OrganizationRecord());

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    organizationBreadcrumb,
    { label: organization.name || "Organization name" },
  ]);

  // Variables
  let organizationId: string = page.params.organizationId as string;
  let openNewOrganizationFormModal: boolean = $state(false);

  // Functions
  function openNewOrganizationModal(): void {
    openNewOrganizationFormModal = true;
  }

  // Functions
  async function fetchOrganization() {
    const organizationRes = await organizationsBackendDataSource.get(organizationId, {
      fields: {
        "dataset/organizations": ["name"],
      },
    });
    organization = organizationRes.data;
    return organization;
  }
</script>

{#snippet EditOrganizationButton()}
  <div class="flex items-center gap-2">
    <Text size="h2" weight="semibold">{organization.name || "Organization name"}</Text>

    <Button variant="outline" onclick={openNewOrganizationModal}>
      <Edit2Icon class="size-4"></Edit2Icon>
    </Button>
  </div>
{/snippet}

{#key $refetches.projects.get}
  {#await fetchOrganization()}
    <PageLoading></PageLoading>
  {:then organization}
    <PageProvider name="organizations">
      <PageHeader>
        {#snippet slotTitle()}
          {@render EditOrganizationButton()}
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
        ></DatasourceTable>
      {/key}
    </PageProvider>

    <OrganizationFormModal action="update" title="Organization" bind:open={openNewOrganizationFormModal}
    ></OrganizationFormModal>
  {/await}
{/key}
