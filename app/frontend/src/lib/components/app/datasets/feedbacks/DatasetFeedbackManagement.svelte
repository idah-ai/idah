<script lang="ts">
  import { getContext, setContext } from "svelte";
  import { SaveCheckIcon, SaveIcon } from "@lucide/svelte";

  import Button from "@/components/ui/button/button.svelte";
  import FeedbackConfigurationDropdownMenu from "@/components/app/datasets/feedbacks/dropdown-menus/FeedbackConfigurationDropdownMenu.svelte";
  import FeedbackList from "@/components/app/datasets/feedbacks/cards/FeedbackList.svelte";
  import PageHeader from "@/components/app/page/page-header.svelte";

  import { DatasetRecord } from "@/data/model/dataset/dataset-record";
  import {
    FEEDBACK_CONFIG_CONTROLLER_KEY,
    FeedBackConfigController,
    setFeedbackConfigController,
  } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";
  import type { IFeedbackConfig } from "@/plugin/v2/types";

  const dataset: DatasetRecord = getContext("dataset");

  const controller = new FeedBackConfigController(dataset.feedback_configuration);
  setContext("key", FEEDBACK_CONFIG_CONTROLLER_KEY);
  setFeedbackConfigController(FEEDBACK_CONFIG_CONTROLLER_KEY, controller);

  function syncSavedConfiguration(config: IFeedbackConfig): void {
    dataset.feedback_configuration = config;
  }

  async function saveChanges(): Promise<void> {
    const savedConfig = await controller.updateConfiguration(dataset.id);

    if (savedConfig) {
      syncSavedConfiguration(savedConfig);
    }
  }
</script>

<PageHeader title="Feedback Configuration">
  {#snippet slotTitle()}
    <div class="flex flex-col gap-2">
      <FeedbackConfigurationDropdownMenu onConfigurationSaved={syncSavedConfiguration} />
    </div>
  {/snippet}

  {#snippet actions()}
    <Button
      loading={controller.isUpdating}
      loadingLabel="Saving..."
      disabled={!controller.hasUnsavedChanges}
      onclick={saveChanges}
    >
      {#if controller.hasUnsavedChanges}
        <SaveIcon />
        Save Changes
      {:else}
        <SaveCheckIcon />
        Saved
      {/if}
    </Button>
  {/snippet}
</PageHeader>

<FeedbackList description="{dataset.totalFeedbackConfig} items configured for this dataset" />
