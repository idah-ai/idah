<script lang="ts">
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import Form from "@/components/app/forms/form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";

  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { entryPriorities } from "@/data/model/dataset/entries/constants";
  import { refetches } from "@/utils/refetch";
  import { toast } from "svelte-sonner";

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
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await updateEntryPriority();
    } catch (error) {
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

  <Form>
    <SingleSelectField
      name="{resource}/priority"
      label="Priority"
      placeholder="Please select priority"
      choices={entryPriorities}
      required
      bind:value={selectedPriority}
    ></SingleSelectField>
  </Form>

  {#snippet confirm()}
    <Button disabled={submitting || selectedPriority === null} onclick={submit}>Set Priority</Button>
  {/snippet}
</FormModal>
