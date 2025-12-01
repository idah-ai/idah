<script lang="ts">
  import Link from "@/components/ui/text/Link.svelte";

  import { OrganizationRecord } from "@/data/model/iam/organizations/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: organization }: DataTableCellBaseProps<OrganizationRecord> = $props();
</script>

<Link href="/organizations/{organization.id}/projects" showIcon>
  {organization.name}
</Link>
