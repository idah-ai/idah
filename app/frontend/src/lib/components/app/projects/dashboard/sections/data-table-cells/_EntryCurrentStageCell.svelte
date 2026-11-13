<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";

  // Props
  let { row: entry }: { row: EntryRecord } = $props();

  // Variables
  const label = $derived(
    entry.status === "completed"
      ? "Done"
      : (entryWorkflowSteps.find((step) => step.value === entry.wf_step)?.label ?? "—"),
  );
</script>

<Text size="sm">{label}</Text>
