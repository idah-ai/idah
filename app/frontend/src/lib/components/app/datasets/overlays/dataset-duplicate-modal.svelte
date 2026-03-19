<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import Button from "@/components/ui/button/button.svelte";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import InputField from "../../forms/fields/input/input-field.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";
  import EntrySelectionCard from "@/components/app/datasets/entries/cards/entry-selection-card.svelte";
  import { DialogTitle } from "@/components/ui/dialog";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  interface Props extends FormModalBaseProps {
    datasetId: string;
    datasetName: string | undefined;
    projectId: string;
    datasetEntryRecords: EntryRecord[];
  }

  let { open = $bindable(), action, title, datasetId, datasetName, projectId, datasetEntryRecords }: Props = $props();

  let submitting = $state(false);
  let newDatasetName = $state("");
  let selectedEntryIds = $state<string[] | undefined>([]);
  let selectAll = $state(true);
  let withAnnotations = $state(false);
  let withLabels = $state(false);

  let isDatasetEmpty = $derived(datasetEntryRecords.length === 0);
  let isSubmitDisabled = $derived(isDatasetEmpty || selectedEntryIds?.length === 0);

  // Set all selected by default when entries arrive or modal opens
  $effect(() => {
    if (open) {
      newDatasetName = `${datasetName} - duplicated`;
      if (isDatasetEmpty) {
        selectAll = false;
        selectedEntryIds = [];
      } else if (selectAll) {
        selectedEntryIds = datasetEntryRecords.map((e) => e.id);
      }
    }
  });

  function resetForm(): void {
    submitting = false;
    newDatasetName = "";
    selectAll = !isDatasetEmpty;
    selectedEntryIds = isDatasetEmpty ? [] : datasetEntryRecords.map((e) => e.id);
  }

  function handleSelectAllChange(checked: boolean) {
    selectAll = checked;
    if (checked) {
      selectedEntryIds = datasetEntryRecords.map((e) => e.id); // in case selectedEntryIds will be used somehow
      // selectedEntryIds = undefined;
    } else {
      selectedEntryIds = [];
    }
  }

  function handleEntryToggle(entryId: string, checked: boolean) {
    const currentIds = selectedEntryIds ?? [];
    if (checked) {
      if (!currentIds.includes(entryId)) {
        selectedEntryIds = [...currentIds, entryId];
      }
    } else {
      selectedEntryIds = currentIds.filter((id) => id !== entryId);
    }
    selectAll = (selectedEntryIds?.length ?? 0) === datasetEntryRecords.length;
  }

  async function submit(): Promise<void> {
    // disable submitting if selectedEntryIds = []

    submitting = true;

    try {
      const createdDatasetRes = await datasetsBackendDataSource.duplicate(datasetId, {
        dataset_name: newDatasetName,
        entry_ids: selectAll === true ? undefined : selectedEntryIds, // passing undefined as backend will loop themselves by default
        with_labels: withLabels,
        with_annotations: withAnnotations,
      });

      open = false;
      $refetches.datasets.list = new Date();
      if (createdDatasetRes?.data?.id) {
        goto(resolve(`/projects/${projectId}/datasets/${createdDatasetRes.data.id}/entries`));
      } else {
        goto(resolve(`/projects/${projectId}/datasets`));
      }
      showToast.success({
        title: "Dataset duplicated",
        description: `The dataset has been duplicated successfully.`,
      });
    } catch (error) {
      submitting = false;
      showActionFailedToast(error);
    }
  }
</script>

<FormModal
  {action}
  {title}
  loading={submitting}
  disabled={isSubmitDisabled}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
  class="sm:max-w-4xl"
>
  {#snippet modalTitle()}
    <DialogTitle>Duplicate Dataset</DialogTitle>
  {/snippet}

  {#snippet confirm()}
    <Button loading={submitting} disabled={isSubmitDisabled} loadingLabel="Duplicating Dataset" onclick={submit}>
      Duplicate Dataset
    </Button>
  {/snippet}

  <div class="flex max-h-[60vh] flex-col gap-4 overflow-hidden">
    <InputField
      name="dataset-name"
      label="New Dataset Name"
      class="flex-1"
      value={newDatasetName}
      oninput={(e) => (newDatasetName = e.currentTarget.value)}
    />

    <div class="flex items-center gap-2">
      <Switch
        id="select-all-entries"
        checked={selectAll}
        onCheckedChange={handleSelectAllChange}
        disabled={isDatasetEmpty}
      />
      <Label for="select-all-entries">Select all entries</Label>

      <Tooltips delayDuration={500}>
        {#snippet trigger()}
          <div class="flex items-center gap-2">
            <Checkbox
              id="with-labels"
              checked={withLabels}
              onCheckedChange={(checked) => {
                withLabels = checked as boolean;
                if (!checked) withAnnotations = false;
              }}
              disabled={isDatasetEmpty}
            />
            <Label for="with-labels">Include Labels</Label>
          </div>
        {/snippet}
        {#snippet content()}
          <p>Include existing labeling configurations</p>
          <p>Required if entries' annotations are included</p>
        {/snippet}
      </Tooltips>

      <Tooltips delayDuration={500}>
        {#snippet trigger()}
          <div class="flex items-center gap-2">
            <Checkbox
              id="with-annotations"
              checked={withAnnotations}
              onCheckedChange={(checked) => {
                withAnnotations = checked as boolean;
                if (checked) withLabels = true;
              }}
              disabled={isDatasetEmpty}
            />
            <Label for="with-annotations">Include Annotations</Label>
          </div>
        {/snippet}
        {#snippet content()}
          <p>Include entries' annotations created</p>
          <p>Required existing labeling configurations</p>
        {/snippet}
      </Tooltips>
    </div>

    <div class="flex flex-col gap-1 overflow-y-auto pr-2">
      {#each datasetEntryRecords as entry (entry.id)}
        <EntrySelectionCard
          {entry}
          selected={selectedEntryIds?.includes(entry.id) ?? false}
          onToggle={handleEntryToggle}
        />
      {/each}

      {#if datasetEntryRecords.length === 0}
        <div class="text-muted-foreground rounded-md border py-4 text-center text-sm">
          No entries found in this dataset.
        </div>
      {/if}
    </div>
  </div>
</FormModal>
