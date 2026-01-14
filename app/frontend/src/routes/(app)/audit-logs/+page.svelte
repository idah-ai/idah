<script lang="ts">
  import DatasourceTable from "@/components/app/datasource-table/datasource-table.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";
  import PageProvider from "@/components/app/page/page-provider.svelte";

  import { logColumns } from "@/components/app/audit/audits/datasource-tables/log-columns";
  import { pageBreadcrumbsStore } from "@/components/app/page/breadcrumbs/stores";
  import { LogRecord, logsBackendDataSource } from "@/data/model/audit/logs/record";
  import { DatasetRecord, datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { MediaRecord } from "@/data/model/media/medias/medias-record";
  import { Record } from "@/data/model/Record";
  import { refetches } from "@/utils/refetch";

  import type { CollectionResponse } from "@/data/model/types";
  import type { Hash } from "@/utils/types";

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
    const accounts: AccountRecord[] = [];
    const accountsRes = await accountsBackendDataSource.list({
      fields: {
        [AccountRecord.type]: ["name", "email", "pciture_url"],
      },
      filters: {
        actor_account_id__in: actorAccountIds,
      },
    });
    accounts.push(...accountsRes.data);

    /** Dynamically fetch name, email or resource name based on the logRecord.resource_type */
    const ids: Hash = {
      accounts: [],
      account_sessions: [],
      organizations: [],
      projects: [],
      project_members: [],
      datasets: [],
      entries: [],
      medias: [],
    };
    response.data.forEach((log) => {
      switch (log.resource_type) {
        case "accounts": {
          if (["logged_in", "logged_out"].includes(log.action)) break;

          ids["accounts"].push(log.resource_id);
          break;
        }
        case "account_sessions":
          {
            ids["account_sessions"].push(log.resource_id);
          }
          break;
        case "organizations": {
          ids["organizations"].push(log.resource_id);
          break;
        }
        case "projects": {
          ids["projects"].push(log.resource_id);
          break;
        }
        case "project_members": {
          ids["project_members"].push(log.resource_id);
          break;
        }
        case "datasets": {
          ids["datasets"].push(log.resource_id);
          break;
        }
        case "entries": {
          ids["entries"].push(log.resource_id);
          break;
        }
        case "medias": {
          ids["medias"].push(log.resource_id);
          break;
        }
        default: {
          break;
        }
      }
    });

    const organizations: OrganizationRecord[] = [];
    const projects: ProjectRecord[] = [];
    const projectMembers: ProjectMemberRecord[] = [];
    const datasets: DatasetRecord[] = [];
    const entries: EntryRecord[] = [];
    const medias: MediaRecord[] = [];
    /** Fetch each resource by ids */
    await Promise.all(
      Object.entries(ids).map(async ([resource, _ids]) => {
        if (_ids.length === 0) return;

        switch (resource) {
          case "accounts": {
            const accountsRes = await accountsBackendDataSource.list({
              fields: {
                [AccountRecord.type]: ["id", "email"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            accounts.push(...accountsRes.data);
            break;
          }
          case "account_sessions": {
            break;
          }
          case "organizations": {
            const organizationsRes = await organizationsBackendDataSource.list({
              fields: {
                [OrganizationRecord.type]: ["id", "name"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            organizations.push(...organizationsRes.data);
            break;
          }
          case "projects": {
            const projectsRes = await projectsBackendDataSource.list({
              fields: {
                [ProjectRecord.type]: ["id", "name"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            projects.push(...projectsRes.data);
            break;
          }
          case "project_members": {
            const projectMembersRes = await projectMembersBackendDataSource.list({
              fields: {
                [ProjectMemberRecord.type]: ["id", "email"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            projectMembers.push(...projectMembersRes.data);
            break;
          }
          case "datasets": {
            const datasetsRes = await datasetsBackendDataSource.list({
              fields: {
                [DatasetRecord.type]: ["id", "name"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            datasets.push(...datasetsRes.data);
            break;
          }
          case "entries": {
            const entriesRes = await entriesBackendDataSource.list({
              fields: {
                [EntryRecord.type]: ["id", "resource"],
              },
              filters: {
                id: Array.from(new Set(_ids)),
              },
            });
            entries.push(...entriesRes.data);
            break;
          }
          default: {
            break;
          }
        }
      }),
    );

    return { accounts, organizations, projects, projectMembers, datasets, entries, medias };
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
        noCache: true,
      }}
      {onLoadSetContexts}
    ></DatasourceTable>
  {/key}
</PageProvider>
