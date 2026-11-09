<script lang="ts">
  import { entryWorkflowSteps } from "@/data/model/dataset/entries/constants";
  import { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  let { record }: { record: EntryRecord } = $props();
</script>

{record.wf_step === "done" ? "Done" : (entryWorkflowSteps.find((step) => step.value === record.wf_step)?.label ?? "—")}
