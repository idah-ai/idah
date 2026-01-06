<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";
  import { getLogResourceDetails } from "@/data/model/audit/logs/utils";
  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { AccountRecord } from "@/data/model/iam/accounts/record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { MediaRecord } from "@/data/model/media/medias/medias-record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: logRecord, contexts }: DataTableCellBaseProps<LogRecord> = $props();

  // Variables
  type Context = {
    accounts: AccountRecord[];
    organizations: OrganizationRecord[];
    projects: ProjectRecord[];
    projectMembers: ProjectMemberRecord[];
    datasets: DatasetRecord[];
    entries: EntryRecord[];
    medias: MediaRecord[];
  };
  let { accounts, organizations, projects, projectMembers, datasets, entries, medias }: Context = $derived(
    (contexts as Context) || {
      accounts: [],
      organizations: [],
      projects: [],
      projectMembers: [],
      datasets: [],
      entries: [],
      medias: [],
    },
  );

  let { resource_type, resource_id } = $derived(logRecord);
  let resourceDetails = $derived(
    getLogResourceDetails(logRecord, {
      accounts,
      organizations,
      projects,
      projectMembers,
      datasets,
      entries,
      medias,
    }),
  );
</script>

<div class="flex flex-col gap-1">
  <Text size="sm">{resourceDetails[resource_type].name || resource_id}</Text>
  <Text size="xs" class="text-muted-foreground">{resourceDetails[resource_type].url}</Text>
</div>
