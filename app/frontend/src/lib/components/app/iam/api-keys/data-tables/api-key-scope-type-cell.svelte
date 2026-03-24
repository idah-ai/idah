<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import type { OrganizationRecord } from "@/data/model/iam/organizations/record";

  // Props
  let { record: apiKeyRecord, contexts }: DataTableCellBaseProps<ApiKeyRecord> = $props();

  // Types
  type Context = {
    organizations: OrganizationRecord[];
    projects: ProjectRecord[];
  };
  let { organizations, projects }: Context = $derived(
    (contexts as Context) || {
      organizations: [],
      projects: [],
    },
  );

  // Variables
  let { scopeTypeLabel, scope_value, scope_type } = $derived(apiKeyRecord);

  // Functions
  function getOrganizationName(orgId: string) {
    return organizations.find((org) => org.id == orgId)?.name || orgId;
  }

  function getProjectName(projectId: string) {
    return projects.find((project) => project.id == projectId)?.name || projectId;
  }
</script>

<TooltipProvider disableCloseOnTriggerClick>
  <Tooltip delayDuration={0}>
    <TooltipTrigger>
      <Badge>
        {scopeTypeLabel}
      </Badge>
    </TooltipTrigger>

    <TooltipContent>
      {#if scope_type === "all"}
        All Access
      {:else}
        {`${scopeTypeLabel}: `}
      {/if}
      {#each scope_value as value, index (index)}
        <div class="flex flex-col gap-1">
          {#if scope_type === "org"}
            {getOrganizationName(value)}
          {:else if scope_type === "project"}
            {getProjectName(value)}
          {/if}
        </div>
      {/each}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
