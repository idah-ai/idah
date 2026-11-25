<script lang="ts">
  import ComboboxTriggerValueBadges from "@/components/app/forms/fields/combobox/combobox-trigger-value-badges.svelte";

  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: target }: DataTableCellBaseProps<StorageTargetRecord> = $props();
</script>

{#if target.organization_ids?.length}
  <ComboboxTriggerValueBadges
    values={target.organization_ids}
    dataSource={organizationsBackendDataSource}
    displayKey="name"
    maxShown={2}
    variant="secondary"
    href={(organization) => `/organizations/${organization.id}/projects`}
  />
{:else}
  <span class="text-muted-foreground text-sm">None yet</span>
{/if}
