<script lang="ts">
  import { page } from "$app/state";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import OrganizationFormModal from "@/components/app/organizations/overlays/organization-form-modal.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageLoading from "@/components/app/page/page-loading.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import Text from "@/components/ui/text/Text.svelte";

  import { organizationProjectColumns } from "@/components/app/organizations/data-tables/organization-project-columns";
  import { homeBreadcrumb, organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { refetches } from "@/utils/refetch";
  import { PencilIcon } from "@lucide/svelte";

  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/dataset/organizations/record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";

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
  async function fetchOrganization(): Promise<OrganizationRecord> {
    const organizationRes = await organizationsBackendDataSource.get(organizationId, {
      fields: {
        "dataset/organizations": ["name"],
      },
    });
    organization = organizationRes.data;
    return organization;
  }
</script>

{#snippet EditOrganizationButton(organization: OrganizationRecord)}
  <div class="flex items-center gap-2">
    <Text size="h2" weight="semibold">{organization.name || "Organization name"}</Text>

    <Button variant="outline" onclick={openNewOrganizationModal}>
      <PencilIcon class="size-4"></PencilIcon>
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
          {@render EditOrganizationButton(organization)}
        {/snippet}
      </PageHeader>

      {#key $refetches.organizations.list}
        <DatasourceTable
          id="organizations-projects-table"
          name="organizations-projects-table"
          refetchKey="organizations"
          columns={organizationProjectColumns}
          dataSource={projectsBackendDataSource}
          listOptions={{
            fields: {
              [ProjectRecord.type]: ["name", "created_at"],
            },
            filters: {
              organization_id: organizationId,
            },
          }}
        ></DatasourceTable>
      {/key}
    </PageProvider>

    <OrganizationFormModal action="update" title="Organization" bind:open={openNewOrganizationFormModal}
    ></OrganizationFormModal>
  {/await}
{/key}
