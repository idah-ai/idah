<script lang="ts">
  import Badge from "@/components/ui/badge/badge.svelte";

  import { FlagIcon } from "@lucide/svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props {
    entry: EntryRecord;
  }
  let { entry }: Props = $props();
</script>

<Badge variant={entry.priorityBadge.variant}>
  <FlagIcon class="mr-2 size-4"></FlagIcon>

  {entry.priorityBadge.label}
</Badge>
