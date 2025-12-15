<script lang="ts">
  import { onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";
  import AddNewProjectButton from "@/components/app/projects/buttons/add-new-project-button.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { projectColumns } from "@/components/app/projects/datasource-tables/project-columns";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import type { Record } from "@/data/model/Record";
  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";

  pageBreadcrumbsStore.set([projectBreadcrumb]);

  // Variables
  let canUpdateProject = $state(false);
  let canDeleteProject = $state(false);
  let columns = $state(projectColumns);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    /**
     * Note: Can not check with `as_project_owner` scope
     * because we need to check each project id
     */
    canUpdateProject = (await currentAccount?.can("update", "dataset:projects", ["as_org_owner", "as_user"])) || false;
    canDeleteProject = (await currentAccount?.can("delete", "dataset:projects", ["as_org_owner", "as_user"])) || false;
    columns.action.visible = canUpdateProject || canDeleteProject;
  });

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

<PageProvider name="projects" roles={["admin", "org_owner", "user"]} action="read" resource="dataset:projects">
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
      {columns}
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
