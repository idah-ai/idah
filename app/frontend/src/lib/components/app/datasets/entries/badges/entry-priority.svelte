<script lang="ts">
  import { ChevronsUpDownIcon, FlagIcon } from "@lucide/svelte";

  import Badge from "@/components/ui/badge/badge.svelte";

  import { entryPriorities } from "@/data/model/dataset/entries/constants";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { cn } from "@/utils";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    entry: EntryRecord;
    updatable?: boolean;
  }
  let { entry, updatable }: Props = $props();

  // Function
  async function changePriority(priorityValue: number) {
    await entriesBackendDataSource.update(entry.id, {
      attributes: {
        priority: priorityValue,
      },
    });
    $refetches.entries.list = new Date();
  }
  let { entry }: Props = $props();
</script>

<Badge variant={entry.priorityBadge.variant}>
  <FlagIcon class="mr-2 size-4"></FlagIcon>

  {entry.priorityBadge.label}
</Badge>
