<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { DownloadIcon } from "@lucide/svelte";
  import { format } from "date-fns";
  import { getContext } from "svelte";

  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { logColumns } from "@/components/app/audit/audits/datasource-tables/log-columns";
  import { getTablePreferences } from "@/components/app/datasource-table/datasource-table.stores.svelte";
  import { homeBreadcrumb, projectBreadcrumb } from "@/components/app/page/breadcrumbs/constants";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { LogRecord, logsBackendDataSource } from "@/data/model/audit/logs/record";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { refetches } from "@/utils/refetch";

  import type { Record } from "@/data/model/Record";
  import type { CollectionResponse } from "@/data/model/types";

  // Contexts
  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  // Variables
  const auditDataSourceTableId: string = "logs";
  let projectId = page.params.projectId as string;
  let datasetId = page.params.datasetId as string;

  pageBreadcrumbsStore.set([
    homeBreadcrumb,
    projectBreadcrumb,
    { label: project.name, href: resolve(`/projects/${projectId}/datasets`) },
    { label: "Datasets", href: resolve(`/projects/${projectId}/datasets`) },
    { label: dataset.name, href: resolve(`/projects/${projectId}/datasets/${datasetId}/entries`) },
    { label: "Logs" },
  ]);

  // Functions
  async function downloadAudits() {
    const auditDataSourceTable = getTablePreferences(auditDataSourceTableId);
    auditDataSourceTable.subscribe((preferences) => {
      console.log(preferences.filters);
    });
  }

  async function onLoadSetContexts<T extends Record = LogRecord>(response: CollectionResponse<T>) {
    /** Fetch related accounts from actorAccountId */
    const actorAccountIds = Array.from(new Set(response.data.map((log) => log.actor_account_id)));
    const accountsRes = await accountsBackendDataSource.list({
      fields: {
        [AccountRecord.type]: ["name", "email", "pciture_url"],
      },
      filters: {
        actor_account_id__in: actorAccountIds,
      },
    });

    return { accounts: accountsRes.data };
  }
</script>

{#key $refetches.logs.list}
  <DatasourceTable
    id={auditDataSourceTableId}
    name="log"
    refetchKey="logs"
    columns={logColumns}
    dataSource={logsBackendDataSource}
    listOptions={{
      fields: {
        [LogRecord.type]: ["event_timestamp", "actor_account_id", "action", "resource_type"],
      },
      // TODO: Filter by dataset_id when backend supports it
      // filters: {
      //   dataset_id: datasetId,
      // },
      sort: ["-event_timestamp"],
    }}
    {onLoadSetContexts}
  >
    {#snippet actions({ tablePreferences })}
      <Button variant="secondary" onclick={downloadAudits}>
        <DownloadIcon />

        Download

        {#if Object.keys(tablePreferences?.filters || {}).includes("event_timestamp__gte")}
          <span class="text-muted-foreground text-xs">
            (
            {format(tablePreferences?.filters["event_timestamp__gte"], "MMM dd, yyyy")} -
            {format(tablePreferences?.filters["event_timestamp__lte"], "MMM dd, yyyy")}
            )
          </span>
        {:else}
          All
        {/if}
      </Button>
    {/snippet}
  </DatasourceTable>
{/key}
