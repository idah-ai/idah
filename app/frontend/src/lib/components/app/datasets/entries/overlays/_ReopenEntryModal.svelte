<script lang="ts">
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import { FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
  import Text from "@/components/ui/text/Text.svelte";

  import { reopenEntries } from "@/components/app/datasets/entries/util/entry-actions";
  import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
  import { humanize } from "@/utils/string";
  import { pluralizeUnit } from "@/utils/unit";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { LabelValue } from "@/utils/types";
  import type { EntryRecord } from "@/data/model/dataset/entries/record";

  // Props
  interface Props extends FormModalBaseProps {
    entryIds: string[];
    entryMap?: Map<string, EntryRecord>;
    onReopened?: (updatedEntries: EntryRecord[]) => void;
  }
  let { action, open = $bindable(), title = "Reopen Entry", entryIds, entryMap, onReopened }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);
  let loadingSteps: boolean = $state(false);
  let availableSteps: string[] = $state([]);
  let selectedStep: string = $state("");
  let loadError: string | null = $state(null);
  let selectedEntryCount: number = $derived(entryIds.length);

  let stepChoices: LabelValue<string | number>[] = $derived(
    availableSteps.map((step) => ({
      label: humanize(step),
      value: step,
    })),
  );
  let targetStageLabel: string = $derived(selectedStep ? humanize(selectedStep) : "");

  // Functions
  function getEntryName(id: string): string | undefined {
    return entryMap?.get(id)?.name;
  }

  async function loadSteps(): Promise<void> {
    const id = entryIds[0];
    loadError = null;

    if (!id) {
      availableSteps = [];
      selectedStep = "";
      return;
    }

    loadingSteps = true;
    try {
      const steps = await entriesBackendDataSource.reopenTargets(id);
      availableSteps = steps;

      selectedStep = steps[0] || "";
    } catch (error) {
      console.error("Failed to load reopen targets:", error);
      availableSteps = [];
      selectedStep = "";
      loadError = "Could not load the workflow steps. Please try again.";
    } finally {
      loadingSteps = false;
    }
  }

  $effect(() => {
    if (!open) return;
    void loadSteps();
  });

  async function submit(): Promise<void> {
    if (!selectedStep) return;

    submitting = true;
    try {
      const updated = await reopenEntries(entryIds, selectedStep);
      if (!updated) return; // failure already toasted; keep modal open
      onReopened?.(updated);
      open = false;
    } catch (error) {
      console.error(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  description={selectedEntryCount > 1
    ? `The selected entries will be moved back to ${targetStageLabel}.`
    : `This entry will be moved back to ${targetStageLabel}.`}
  loading={submitting}
  onCancel={() => {}}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <FieldSet class="p-1">
    <FieldGroup>
      <SingleSelectField
        name="reopen-target-step"
        label="Stage"
        placeholder="Select a stage"
        choices={stepChoices}
        disabled={loadingSteps || availableSteps.length === 0}
        value={selectedStep}
        onSelected={(value: string | number | null) => {
          if (typeof value === "string") selectedStep = value;
        }}
      />
    </FieldGroup>
  </FieldSet>

  <FieldSet class="p-1">
    <FieldGroup class="gap-1">
      {#if selectedEntryCount > 0}
        <FieldLabel>{pluralizeUnit(selectedEntryCount, "Selected entry", "Selected entries")}</FieldLabel>
      {/if}

      <ul class="max-h-48 space-y-1 overflow-y-auto rounded-md border px-4 py-2">
        {#each entryIds as id (id)}
          <li class="text-muted-foreground truncate text-sm">
            {getEntryName(id) || id}
          </li>
        {/each}
      </ul>

      {#if loadError}
        <Text size="sm" class="text-destructive">{loadError}</Text>
      {/if}
    </FieldGroup>
  </FieldSet>

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Reopening" disabled={loadingSteps || !selectedStep} onclick={submit}>
      Reopen
    </Button>
  {/snippet}
</FormModal>
