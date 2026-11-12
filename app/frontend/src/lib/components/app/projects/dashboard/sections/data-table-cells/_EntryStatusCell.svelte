<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";
  import { getEntryWorkflowGroup } from "@/components/app/projects/dashboard/project-dashboard.constants";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();
  const status = $derived(getEntryWorkflowGroup(entry));
</script>

<Badge variant={status?.badgeColor ?? entry.statusBadge.variant}>{status?.label ?? entry.statusBadge.label}</Badge>
