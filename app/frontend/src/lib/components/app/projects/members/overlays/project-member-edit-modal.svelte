<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Button from "@/components/ui/button/button.svelte";
  import DialogTitle from "@/components/ui/dialog/dialog-title.svelte";
  import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import {
    ProjectMemberRecord,
    projectMemberRoles,
    projectMembersBackendDataSource,
    type ProjectMemberRole,
  } from "@/data/model/dataset/projects/members/record";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { refetches } from "@/utils/refetch";

  // Props
  interface Props {
    open: boolean;
    projectMember: ProjectMemberRecord;
  }
  let { open = $bindable(), projectMember }: Props = $props();

  // Variables
  let selectedRole: ProjectMemberRole | null = $state(projectMember.role);
  let submitting: boolean = $state(false);
  let disabledSubmitButton: boolean = $derived(selectedRole === null);

  // Functions
  function resetForm(): void {
    selectedRole = projectMember.role;
  }

  async function submit(): Promise<void> {
    if (!selectedRole) return;

    submitting = true;

    try {
      await projectMembersBackendDataSource.update(
        projectMember.id,
        { attributes: { role: selectedRole } },
        { showErrorToast: false },
      );

      open = false;
      submitting = false;
      $refetches.projectMembers.list = new Date();
      showToast.success({
        title: "Member role updated",
        description: `"${projectMember.email}" is now a ${projectMemberRoles.find((r) => r.value === selectedRole)?.label}.`,
      });
    } catch (error) {
      submitting = false;
      showActionFailedToast(error);
    }
  }
</script>

<FormModal action="update" title="Member" onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet modalTitle()}
    <DialogTitle>Edit Member</DialogTitle>
  {/snippet}

  <FieldSet class="p-1">
    <FieldGroup>
      <div class="flex w-full items-end gap-2">
        <Field class="flex-1">
          <FieldLabel>Email</FieldLabel>
          <input
            class="border-input dark:bg-input/30 placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-sm font-medium shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={projectMember.email}
            disabled
          />
        </Field>

        <SingleSelectField
          name="{ProjectMemberRecord.type}/role"
          class="flex-1"
          label="Role"
          placeholder="Select a role"
          choices={projectMemberRoles}
          required
          searchable
          searchPlaceholder="Search a role"
          value={selectedRole}
          onSelected={(selectedValue) => {
            selectedRole = selectedValue as ProjectMemberRole | null;
          }}
        />
      </div>
    </FieldGroup>
  </FieldSet>

  {#snippet confirm()}
    <Button loading={submitting} loadingLabel="Saving" disabled={disabledSubmitButton} onclick={submit}>
      Save
    </Button>
  {/snippet}
</FormModal>
