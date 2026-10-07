<script lang="ts">
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { PlusIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Can from "@/security/can.svelte";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import type { ProjectMemberScope } from "@/security/types";

  const projectId = page.params.projectId as string;
  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);

  const as_project_owner: { as_user: ProjectMemberScope } = {
    as_user: {
      projectId,
      projectMemberRoles: ["project_owner"],
    },
  };
</script>

<Can action="create" resource="dataset:feedback_config_templates" scopes={["as_org_owner", as_project_owner]}>
  <Button variant="outline" onclick={() => controller.openFormModal()}>
    <PlusIcon />
    Add Feedback
  </Button>
</Can>
