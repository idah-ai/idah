<script lang="ts">
  import AssignEntryForm from "@/components/app/datasets/entries/forms/assign-entry-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    entryIds: string[];
  }
  let { action, open = $bindable(), title = "Assign to", entryIds }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);
  let selectedMember: number | null = $state(null);
  let selectedEntryCount: number = $derived(entryIds.length);

  // Functions
  function resetForm(): void {
    selectedMember = null;
  }

  function setValue(value: Hash): void {
    selectedMember = value.assigned_to_id;
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

<FormModal
  {action}
  {title}
  description="Assign selected member to {selectedEntryCount > 1 ? `${selectedEntryCount} task` : 'task'}"
  loading={submitting}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <AssignEntryForm {selectedMember} onValueChange={setValue}></AssignEntryForm>

  {#snippet confirm()}
    <Button disabled onclick={submit}>Assign</Button>
  {/snippet}
</FormModal>
