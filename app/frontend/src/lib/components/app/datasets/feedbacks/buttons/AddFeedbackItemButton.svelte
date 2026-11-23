<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";

  const projectId = page.params.projectId as string;
  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);
</script>

<Can action="update" resource="dataset:datasets" {projectId} minRole="project_owner">
  <Button variant="outline" onclick={() => controller.openFormModal()}>
    <PlusIcon />
    Add Feedback
  </Button>
</Can>
