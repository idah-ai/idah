<script lang="ts">
  import AssignEntryForm from "@/components/app/datasets/entries/forms/assign-entry-form.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Spinner from "@/components/app/loading/spinner.svelte";

  import { refetches } from "@/utils/refetch";
  import { toast } from "svelte-sonner";
  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    entryRecord?: EntryRecord;
    entryIds: string[];
  }
  let { action, open = $bindable(), title = "Assign to", entryRecord, entryIds }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);
  let fieldErrors: Hash = $state({});
  let selectedMember: number | null = $state(entryRecord?.assigned_to_id ?? null);
  let selectedEntryCount: number = $derived(entryIds.length);

  // Functions
  function setValue(value: Hash): void {
    selectedMember = value.assigned_to_id;
  }

  async function assignMember(): Promise<void> {
    if (entryIds.length === 0 || !selectedMember) return;

    for (const entryId of entryIds) {
      await entriesBackendDataSource.assign({ id: entryId, memberId: selectedMember });
    }

    toast.success("Member assigned successfully");
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await assignMember();
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
  description="Assign {selectedEntryCount > 1 ? `${selectedEntryCount} tasks` : 'task'} to a member"
  loading={submitting}
  onCancel={() => {}}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <AssignEntryForm {selectedMember} {fieldErrors} onValueChange={setValue}></AssignEntryForm>

  {#snippet confirm()}
    <Button disabled={submitting || !selectedMember} onclick={submit}>
      {#if submitting}
        <Spinner></Spinner>
        Assigning...
      {:else}
        Assign
      {/if}
    </Button>
  {/snippet}
</FormModal>
