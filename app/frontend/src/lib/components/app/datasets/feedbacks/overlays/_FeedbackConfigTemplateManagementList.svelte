<script lang="ts">
  import { setContext } from "svelte";
  import { ArrowDownIcon, SaveIcon, Trash2Icon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import EditableTextField from "@/components/app/forms/fields/editable-text/EditableTextField.svelte";
  import FeedbackList from "@/components/app/datasets/feedbacks/cards/FeedbackList.svelte";

  import { ConfirmModalChoice } from "@/components/app/overlays/modals/confirm-modal.types";
  import {
    FEEDBACK_CONFIG_CONTROLLER_KEY,
    FEEDBACK_CONFIG_TEMPLATE_CONTROLLER_KEY,
    FeedBackConfigController,
    feedbackConfigTemplate,
    getFeedbackConfigController,
    setFeedbackConfigController,
  } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import { showConfirmModal } from "@/components/app/overlays/modals/confirm-modal.service.svelte";
  import type { IFeedbackConfig } from "@/data/model/dataset/feedback-config-templates/record";

  interface Props {
    feedbackConfig: IFeedbackConfig;
  }
  let { feedbackConfig }: Props = $props();

  const datasetConfigKey: symbol = FEEDBACK_CONFIG_CONTROLLER_KEY;
  const configTemplateKey: symbol = setContext("key", FEEDBACK_CONFIG_TEMPLATE_CONTROLLER_KEY);
  const configTemplateController = new FeedBackConfigController(feedbackConfig);
  const datasetConfigController = getFeedbackConfigController(datasetConfigKey);
  setFeedbackConfigController(configTemplateKey, configTemplateController);

  async function openConfirmDeleteModal() {
    if (feedbackConfigTemplate.isNotSelected) return;

    const choice = await showConfirmModal({
      title: "Delete Template?",
      description: `Are you sure you wanty to delete this template "${feedbackConfigTemplate.selection?.name}"? This action cannot be undone.`,
      confirmLabel: "Yes, Delete",
    });

    if (choice === ConfirmModalChoice.Cancel) return;

    await feedbackConfigTemplate.delete();
  }

  async function saveTemplate() {
    feedbackConfigTemplate.save({ newConfig: configTemplateController.getConfigHash() });
    configTemplateController.markCurrentAsSaved();
  }

  function applyTemplate() {
    if (feedbackConfigTemplate.isNotSelected) return;

    datasetConfigController.apply(configTemplateController.getConfigHash());
    feedbackConfigTemplate.closeSheet();
    feedbackConfigTemplate.unSelectTemplate();
  }
</script>

{#if feedbackConfigTemplate.selection}
  <div class="grid items-start gap-6 px-4 pb-4">
    <section class="flex items-center">
      <EditableTextField
        inputClass="min-w-80"
        value={feedbackConfigTemplate.selection?.name || ""}
        disabled={feedbackConfigTemplate.isPending}
        onSave={(newName) => feedbackConfigTemplate.rename(newName)}
        placeholder="Untitled"
      />

      <div class="ml-auto flex items-center gap-4">
        <Button
          variant="destructive-outline"
          loading={feedbackConfigTemplate.isDeleting}
          loadingLabel="Deleting..."
          disabled={feedbackConfigTemplate.isPending}
          onclick={openConfirmDeleteModal}
        >
          <Trash2Icon />
          Delete
        </Button>

        <Button
          variant="outline"
          loading={feedbackConfigTemplate.isUpdating}
          loadingLabel="Saving..."
          disabled={!configTemplateController.hasUnsavedChanges || feedbackConfigTemplate.isPending}
          onclick={saveTemplate}
        >
          <SaveIcon />
          {configTemplateController.hasUnsavedChanges ? "Save Changes" : "Saved"}
        </Button>

        <Button onclick={applyTemplate}>
          <ArrowDownIcon />
          Apply This Template
        </Button>
      </div>
    </section>

    <FeedbackList description={`Items included in the "${feedbackConfigTemplate.selection.name}" template`} />
  </div>
{/if}
