<script lang="ts">
  import { toast } from "svelte-sonner";

  import AssignEntryForm from "@/components/app/datasets/entries/forms/assign-entry-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";

  import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
  import { ProjectMemberRecord, projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

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
  let selectedMemberAccountId: number | null = $state(entryRecord?.assigned_to_id ?? null);
  let selectedEntryCount: number = $derived(entryIds.length);

  // Functions
  function setValue(value: Hash): void {
    selectedMemberAccountId = value.assigned_to_id;
  }

  async function assignMember(): Promise<void> {
    if (entryIds.length === 0 || !selectedMemberAccountId) return;

    let projectMemberRecord: ProjectMemberRecord | undefined = $state(undefined);

    for (const entryId of entryIds) {
      await entriesBackendDataSource.assign({ id: entryId, memberAccountId: selectedMemberAccountId });

      /** Get the email of selected member */
      const projectMemberRes = await projectMembersBackendDataSource.list({
        fields: {
          [ProjectMemberRecord.type]: ["email"],
        },
        filters: {
          account_id: selectedMemberAccountId,
        },
      });

      projectMemberRecord = projectMemberRes.data.at(0);
    }

    open = false;
    $refetches.entries.list = new Date();
    toast.success("Entry assigned", {
      description: `The entry "${entryRecord?.resource}" has been assigned to "${projectMemberRecord?.email}".`,
    });
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await assignMember();
    } catch (error) {
      submitting = false;
      showActionFailedToast(error);
    }
  }
</script>

<FormModal
  {action}
  {title}
  description="Assign {selectedEntryCount > 1 ? `${selectedEntryCount} entries` : 'entry'} to a member"
  loading={submitting}
  onCancel={() => {}}
  onConfirm={submit}
  bind:open
>
  {#snippet modalTitle()}
    <DialogTitle>{title}</DialogTitle>
  {/snippet}

  <AssignEntryForm {selectedMemberAccountId} {entryRecord} {fieldErrors} onValueChange={setValue} />

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Assigning" disabled={!selectedMemberAccountId} onclick={submit}>
      Assign
    </Button>
  {/snippet}
</FormModal>
