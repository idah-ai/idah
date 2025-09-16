<script lang="ts">
  import AssignEntryForm from "@/components/app/datasets/entries/forms/assign-entry-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    entryRecord?: EntryRecord;
  }
  let { action, open = $bindable(), title = "Assign to", entryRecord }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);

  let entry: EntryRecord = $derived(
    entryRecord
      ? entryRecord
      : new EntryRecord({
          type: EntryRecord.type,
          attributes: {
            assigned_to_id: null,
          },
        }),
  );

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {
        assigned_to_id: null,
      },
    });
  }

  function setValue(value: Hash): void {
    entry.assigned_to_id = value.assigned_to_id;
  }

  async function assignMemberToEntry(): Promise<void> {}

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await assignMemberToEntry();
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <AssignEntryForm {entry} onValueChange={setValue}></AssignEntryForm>

  {#snippet confirm()}
    <Button disabled onclick={submit}>Assign</Button>
  {/snippet}
</FormModal>
