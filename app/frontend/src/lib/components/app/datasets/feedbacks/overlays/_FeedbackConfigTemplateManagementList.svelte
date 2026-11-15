<script lang="ts">
  import { getContext, setContext } from "svelte";
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
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import type { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import type { IFeedbackConfig } from "@/plugin/v2/types";

  interface Props {
    feedbackConfig: IFeedbackConfig;
  }
  let { feedbackConfig }: Props = $props();

  const datasetConfigKey: symbol = FEEDBACK_CONFIG_CONTROLLER_KEY;
  const configTemplateKey: symbol = setContext("key", FEEDBACK_CONFIG_TEMPLATE_CONTROLLER_KEY);
  const configTemplateController = new FeedBackConfigController(feedbackConfig);
  const datasetConfigController = getFeedbackConfigController(datasetConfigKey);
  const dataset: DatasetRecord = getContext("dataset");
  setFeedbackConfigController(configTemplateKey, configTemplateController);

  async function openConfirmDeleteModal() {
    if (feedbackConfigTemplate.isNotSelected) return;

    const choice = await showConfirmModal({
      title: "Delete Template?",
      description: `Are you sure you want to delete this template "${feedbackConfigTemplate.selection?.name}"? This action cannot be undone.`,
      confirmLabel: "Yes, Delete",
    });

    if (choice === ConfirmModalChoice.Cancel) return;

    await feedbackConfigTemplate.delete();
  }

  async function saveTemplate() {
    if (await feedbackConfigTemplate.save({ newConfig: configTemplateController.getConfigHash() })) {
      configTemplateController.markCurrentAsSaved();
    }
  }

  async function applyTemplate() {
    if (feedbackConfigTemplate.isNotSelected) return;

    try {
      const { keys } = await datasetConfigController.loadKeysInUse(dataset.id);
      const itemsInUse = Object.fromEntries(
        keys
          .filter((key) => key in dataset.feedback_configuration)
          .map((key) => [key, dataset.feedback_configuration[key]]),
      );
      datasetConfigController.apply(configTemplateController.getConfigHash(), itemsInUse);
      feedbackConfigTemplate.closeSheet();
      feedbackConfigTemplate.unSelectTemplate();
    } catch (err) {
      showActionFailedToast(err);
    }
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

    <FeedbackList
      description={`Items included in the "${feedbackConfigTemplate.selection.name}" template`}
      isTemplate
    />
  </div>
{/if}
