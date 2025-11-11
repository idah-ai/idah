<script lang="ts">
  import { toast } from "svelte-sonner";

  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { entryPriorities } from "@/data/model/dataset/entries/constants";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  // Props
  interface Props extends FormModalBaseProps {
    entryRecord?: EntryRecord;
    entryIds: string[];
  }
  let { action, open = $bindable(), title = "Set Priority", entryRecord, entryIds }: Props = $props();

  // Variables
  let resource: string = EntryRecord.type;
  let submitting: boolean = $state(false);
  let selectedPriority: number | null = $state(entryRecord?.priority ?? null);
  let selectedEntryCount: number = $derived(entryIds.length);

  // Functions
  function resetForm(): void {
    selectedPriority = null;
  }

  async function updateEntryPriority(): Promise<void> {
    for (const entryId of entryIds) {
      await entriesBackendDataSource.update(entryId, {
        attributes: {
          priority: selectedPriority!,
        },
      });
    }

    toast.success(`${selectedEntryCount} tasks has been set priority successfully!`);
    $refetches.entries.list = new Date();
    open = false;
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await updateEntryPriority();
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
  description="Set priority to {selectedEntryCount > 1 ? `${selectedEntryCount} tasks` : 'task'}"
  loading={submitting}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <FieldSet class="p-1">
    <FieldGroup>
      <SingleSelectField
        name="{resource}/priority"
        label="Priority"
        placeholder="Please select priority"
        choices={entryPriorities}
        required
        bind:value={selectedPriority}
      ></SingleSelectField>
    </FieldGroup>
  </FieldSet>

  {#snippet confirm()}
    <Button disabled={submitting || selectedPriority === null} onclick={submit}>Set Priority</Button>
  {/snippet}
</FormModal>
