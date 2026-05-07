<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import { datasetsBackendDataSource } from "@/data/model/dataset/dataset-record";
  import { DialogTitle } from "@/components/ui/dialog";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import { showToast } from "@/components/ui/toast/index.svelte";

  import Button from "@/components/ui/button/button.svelte";
  import Checkbox from "@/components/ui/checkbox/checkbox.svelte";
  import EntrySelectionCard from "@/components/app/datasets/entries/cards/entry-selection-card.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import Label from "@/components/ui/label/label.svelte";
  import Switch from "@/components/ui/switch/switch.svelte";
  import Tooltips from "@/components/app/tooltips/tooltips.svelte";

  interface Props extends FormModalBaseProps {
    datasetId: string;
    datasetName: string | undefined;
    projectId: string;
    datasetEntryRecords: EntryRecord[];
    duplicatingEntriesTotalCount: number;
  }

  let {
    open = $bindable(),
    action,
    title,
    datasetId,
    datasetName,
    projectId,
    datasetEntryRecords,
    duplicatingEntriesTotalCount,
  }: Props = $props();

  let submitting = $state(false);
  let selectedEntryIds = $state<string[] | undefined>([]);
  let selectAll = $state(true);
  let withAnnotations = $state(false);
  let withLabels = $state(false);

  let isDatasetEmpty = $derived(datasetEntryRecords.length === 0);
  let isSubmitDisabled = $derived(isDatasetEmpty || selectedEntryIds?.length === 0);

  let newDatasetName = $derived(open ? `${datasetName} - duplicated` : "");

  // set entries selected by default
  $effect(() => {
    if (open) {
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
    // disable submitting just in case if there's no entry to do so
    if (!selectAll && (!selectedEntryIds || selectedEntryIds.length === 0)) {
      return;
    }

    submitting = true;

    try {
      const createdDatasetRes = await datasetsBackendDataSource.duplicate(datasetId, {
        dataset_name: newDatasetName,
        entry_ids: selectAll === true ? undefined : selectedEntryIds, // passing undefined as backend will loop themselves by default
        with_labels: withLabels,
        with_annotations: withAnnotations,
      });

      if (createdDatasetRes?.data?.id) {
        const newDatasetUrl = resolve(`/projects/${projectId}/datasets/${createdDatasetRes.data.id}/entries`);

        // auto-refetch configuration
        const AUTO_REFETCH_INTERVAL_MS = 1000; // refetch every 2 seconds
        const expectedCount = selectAll ? duplicatingEntriesTotalCount : (selectedEntryIds?.length ?? 0);
        const defaultItemsPerPage = 10; // TODO: get from const some where else ?
        const MAX_REFETCH_ATTEMPTS = 30; // max 30 seconds wait
        let attempts = 0;
        let isDuplicating = true;

        // also stop loop if modal is closed/canceled
        while (isDuplicating && attempts < MAX_REFETCH_ATTEMPTS && open) {
          const res = await datasetsBackendDataSource.get(createdDatasetRes.data.id, { noCache: true });
          if (res.data.entries_total_count >= expectedCount || res.data.entries_total_count >= defaultItemsPerPage) {
            isDuplicating = false;
          } else {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, AUTO_REFETCH_INTERVAL_MS));
          }
        }

        if (open) {
          await goto(newDatasetUrl);
        }
      } else {
        const fallbackUrl = resolve(`/projects/${projectId}/datasets`);
        await goto(fallbackUrl);
      }

      // close modal and update state after navigation
      open = false;
      submitting = false;

      showToast.success({
        title: "Dataset duplicated",
        description: `The dataset has been duplicated successfully.`,
      });
    } catch (error) {
      console.error("Dataset duplication failed:", error);
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

    <div class="grid grid-cols-2 gap-2 overflow-y-auto pr-2 md:grid-cols-4">
      {#each datasetEntryRecords as entry (entry.id)}
        <EntrySelectionCard
          {entry}
          selected={selectedEntryIds?.includes(entry.id) ?? false}
          onToggle={handleEntryToggle}
        />
      {:else}
        <div class="text-muted-foreground col-span-full rounded-md border py-4 text-center text-sm">
          No entries found in this dataset.
        </div>
      {/each}
    </div>
  </div>
</FormModal>
