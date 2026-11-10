<script lang="ts">
  import { getContext } from "svelte";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";

  import {
    feedbackConfigTemplate,
    getFeedbackConfigController,
  } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import type { Resource } from "@/security/types";
  import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

  const project: ProjectRecord = getContext("project");
  const dataset: DatasetRecord = getContext("dataset");

  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);
  const resource: Resource = "dataset:feedback_config_templates";

  let name = $state<string>("");

  const disabledSaveButton = $derived(!name.trim() || controller.configIsEmpty);

  function resetForm() {
    name = "";
  }

  /** Close this modal then reset form */
  function closeThisModal() {
    feedbackConfigTemplate.closeFormModal();
    resetForm();
  }

  async function submit() {
    feedbackConfigTemplate.create({
      name,
      modality: dataset.modality,
      organizationId: project.organization_id,
      config: controller.getConfigHash(),
    });

    resetForm();
  }
</script>

<FormModal
  action="create"
  title="Template"
  loading={feedbackConfigTemplate.isCreating}
  disabled={disabledSaveButton}
  onCancel={closeThisModal}
  onConfirm={submit}
  bind:open={feedbackConfigTemplate.formModalOpen}
>
  <section class="px-1 pb-1">
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="Template name"
      required
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
  </section>
</FormModal>
