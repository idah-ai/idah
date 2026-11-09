<script lang="ts">
  import Text from "@/components/ui/text/Text.svelte";
  import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

<Text size="sm">
  {record.wf_step === "done"
    ? "Done"
    : (entryWorkflowSteps.find((step) => step.value === record.wf_step)?.label ?? "—")}
</Text>
