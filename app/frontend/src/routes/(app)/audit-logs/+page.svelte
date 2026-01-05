<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";

  import { logColumns } from "@/components/app/audit/audits/datasource-tables/log-columns";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { LogRecord, logsBackendDataSource } from "@/data/model/audit/logs/record";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { Record } from "@/data/model/Record";
  import { refetches } from "@/utils/refetch";

  import type { CollectionResponse } from "@/data/model/types";

  // Variables
  const logDatasourceTableId = "audit-logs";

  pageBreadcrumbsStore.set([{ label: "Audit Logs" }]);

  // Functions
  // async function downloadAudits() {
  //   const auditDataSourceTable = getTablePreferences(logDatasourceTableId);
  //   auditDataSourceTable.subscribe((preferences) => {
  //     console.log(preferences.filters);
  //   });
  // }

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

<PageProvider name="audit-logs" roles={["admin"]} action="read" resource="audit:logs">
  <PageHeader title="Audit Logs">
    <!-- {#snippet actions()}
      <Button onclick={downloadAudits}>
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
    {/snippet} -->
  </PageHeader>

  {#key $refetches.logs.list}
    <DatasourceTable
      id={logDatasourceTableId}
      name="log"
      refetchKey="logs"
      columns={logColumns}
      dataSource={logsBackendDataSource}
      listOptions={{
        filters: {
          actor_account_role_name__nin: ["system"],
        },
        sort: ["-event_timestamp"],
      }}
      {onLoadSetContexts}
    ></DatasourceTable>
  {/key}
</PageProvider>
