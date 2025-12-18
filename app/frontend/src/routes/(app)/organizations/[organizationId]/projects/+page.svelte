<script lang="ts">
  import { resolve } from "$app/paths";

  import { page } from "$app/state";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import AddNewProjectButton from "@/components/app/projects/buttons/add-new-project-button.svelte";

  import { organizationProjectColumns } from "@/components/app/organizations/data-tables/organization-project-columns";
  import { organizationBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  // Contexts
  const organization: OrganizationRecord = getContext("organization");

  // Variables
  let organizationId: string = page.params.organizationId as string;

  pageBreadcrumbsStore.set([
    organizationBreadcrumb,
    { label: organization.name, href: resolve(`/organizations/${organizationId}/projects`) },
    { label: "Projects" },
  ]);
</script>

{#key $refetches.projects.list}
  <DatasourceTable
    id="organization-projects-{organizationId}"
    name="project"
    refetchKey="projects"
    columns={organizationProjectColumns}
    dataSource={projectsBackendDataSource}
    listOptions={{
      filters: {
        organization_id: organizationId,
      },
    }}
  >
    {#snippet addNewRecordButton()}
      <AddNewProjectButton />
    {/snippet}
  </DatasourceTable>
{/key}
