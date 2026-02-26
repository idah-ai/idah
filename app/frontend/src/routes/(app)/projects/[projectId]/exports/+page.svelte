<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getContext, onMount } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";

  import { projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { authStatus } from "@/security/AuthContext";
  import { refetches } from "@/utils/refetch";

  import { exportsColumns } from "@/components/app/projects/exports/datasource-tables/export-columns";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { ExportRecord, ExportsBackendDataSource } from "@/data/model/sync/exports/record";
  import { SyncJobRecord } from "@/data/model/sync/jobs/record";

  import type { Record } from "@/data/model/Record";
  import type { CollectionResponse } from "@/data/model/types";
  import type { ProjectMemberScope } from "@/security/types";

  // Contexts
  const project: ProjectRecord = getContext("project");

  pageBreadcrumbsStore.set([
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${project.id}/exports`) },
    { label: "Exports" },
  ]);

  // Variables
  let projectId = page.params.projectId as string;
  let canExport = $state(false);
  let columns = $state(exportsColumns);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    const as_project_owner: { as_user: ProjectMemberScope } = {
      as_user: {
        projectId,
        projectMemberRoles: ["project_owner"],
      },
    };
    canExport = (await currentAccount?.can("create", "sync:exports", ["as_org_owner", as_project_owner])) || false;
    columns.action.visible = canExport;
  });

  async function onLoadSetContexts<T extends Record = ExportRecord>(response: CollectionResponse<T>) {
    /** Fetch related datasets from exportRecord.job.arguments.dataset_ids */
    const datasetIds = Array.from(
      new Set(response.data.map((exportRecord) => exportRecord.job.arguments.dataset_ids).flat()),
    );

    const datasetsRes = await datasetsBackendDataSource.list({
      fields: {
        [DatasetRecord.type]: ["id", "name"],
      },
      filters: {
        id: datasetIds,
      },
    });

    return { datasets: datasetsRes.data };
  }
</script>

{#key $refetches.projectMembers.list}
  <DatasourceTable
    id="exports-{projectId}"
    name="export"
    refetchKey="exports"
    {columns}
    dataSource={ExportsBackendDataSource}
    disabledActiveStateFilterSortKeys={["project_id"]}
    listOptions={{
      fields: {
        [ExportRecord.type]: ["id", "job_id"],
        [SyncJobRecord.type]: ["id", "arguments", "status"],
      },
      filters: {
        project_id: projectId,
      },
      included: ["job"],
    }}
    {onLoadSetContexts}
  ></DatasourceTable>
{/key}
