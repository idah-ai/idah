<script lang="ts">
  import OrganizationDropdownMenu from "@/components/app/organizations/dropdowns/organization-dropdown-menu.svelte";

  import { OrganizationRecord } from "@/data/model/iam/organizations/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: organizationRecord }: DataTableCellBaseProps<OrganizationRecord> = $props();
</script>

<OrganizationDropdownMenu organizationId={organizationRecord.id} />
