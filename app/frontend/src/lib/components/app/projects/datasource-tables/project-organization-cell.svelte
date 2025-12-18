<script lang="ts">
  import { onMount } from "svelte";

  import Link from "@/components/ui/text/Link.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: project, contexts }: DataTableCellBaseProps<ProjectRecord> = $props();

  // Variables
  let canUpdateOrganization = $state(false);

  const organizations: OrganizationRecord[] = $derived(contexts?.organizations ?? []);
  const projectOrganization = $derived(
    organizations.find((organization) => organization.id == String(project.organization_id)),
  );

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    canUpdateOrganization = (await currentAccount?.can("update", "iam:organizations")) || false;
  });
</script>

{#if canUpdateOrganization}
  <Link href="/organizations/{project.organization_id}/projects" showIcon>
    {projectOrganization?.name}
  </Link>
{:else}
  {projectOrganization?.name}
{/if}
