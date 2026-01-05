<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";

  import { LogRecord } from "@/data/model/audit/logs/record";

  import type { DataTableCellBaseProps } from "@/components/app/datasource-table/types";

  // Props
  let { record: logRecord }: DataTableCellBaseProps<LogRecord> = $props();

  // Variables
  let { action, resource_type, resource_id, organization_id, project_id, dataset_id, entry_id } = $derived(logRecord);
  let url = $derived.by(() => {
    switch (resource_type) {
      case "accounts": {
        if (action === "logged_in") return `/login`;

        return `/accounts/${resource_id}`;
      }
      case "account_sessions": {
        return `/logout`;
      }
      case "organizations": {
        return `/organizations/${organization_id}`;
      }
      case "projects": {
        return `/projects/${project_id}`;
      }
      case "datasets": {
        return `/projects/${project_id}/datasets/${dataset_id}`;
      }
      case "entries": {
        return `/projects/${project_id}/datasets/${dataset_id}/entries/${entry_id}`;
      }
    }
  });
</script>

<div class="flex flex-col gap-1">
  <Text size="sm">{resource_id}</Text>
  <Text size="xs" class="text-muted-foreground">{url}</Text>
</div>
