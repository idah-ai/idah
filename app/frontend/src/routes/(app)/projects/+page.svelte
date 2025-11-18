<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import AddNewProjectButton from "@/components/app/projects/buttons/add-new-project-button.svelte";

  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectColumns } from "@/components/app/projects/datasource-tables/project-columns";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { refetches } from "@/utils/refetch";

  import type { Record } from "@/data/model/Record";
  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";

  pageBreadcrumbsStore.set([homeBreadcrumb, projectBreadcrumb]);

  // Functions
  async function onLoadSetContexts<T extends Record = ProjectRecord>(response: CollectionResponse<T>): Promise<Hash> {
    /** Fetch related datasets from projectIds */
    const projectIds = Array.from(new Set(response.data.map((project) => project.id)));
    const datasetsRes = await datasetsBackendDataSource.list({
      fields: {
        "dataset:datasets": ["labels"],
        "dataset:projects": [],
      },
      filters: {
        project_id__in: projectIds,
      },
      included: ["project"],
    });

    /** Fetch related organizations from projectIds */
    const organizationIds = Array.from(new Set(response.data.map((project) => project.organization_id)));
    const organizationsRes = await organizationsBackendDataSource.list({
      fields: {
        [OrganizationRecord.type]: ["name"],
      },
      filters: {
        id__in: organizationIds,
      },
    });

    return { datasets: datasetsRes.data, organizations: organizationsRes.data };
  }
</script>

<PageProvider name="projects">
  <PageHeader title="Projects">
    {#snippet actions()}
      <AddNewProjectButton />
    {/snippet}
  </PageHeader>

  {#key $refetches.projects.list}
    <DatasourceTable
      id="projects"
      name="project"
      refetchKey="projects"
      columns={projectColumns}
      dataSource={projectsBackendDataSource}
      listOptions={{
        fields: {
          "dataset:projects": ["name", "description", "organization_id", "created_at"],
        },
        sort: ["-created_at"],
      }}
      {onLoadSetContexts}
    >
      {#snippet addNewRecordButton()}
        <AddNewProjectButton />
      {/snippet}
    </DatasourceTable>
  {/key}
</PageProvider>
