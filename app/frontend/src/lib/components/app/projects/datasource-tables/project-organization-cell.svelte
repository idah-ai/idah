<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";

  import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import { OrganizationRecord } from "@/data/model/iam/organizations/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: project, contexts }: DataTableCellBaseProps<ProjectRecord> = $props();

  // Variables
  const organizations: OrganizationRecord[] = $derived(contexts?.organizations ?? []);
  const projectOrganization = $derived(
    organizations.find((organization) => organization.id == String(project.organization_id)),
  );
</script>

<Link href="/organizations/{project.organization_id}/projects" showIcon>
  {projectOrganization?.name}
</Link>
