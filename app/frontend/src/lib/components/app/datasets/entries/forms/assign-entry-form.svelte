<script lang="ts">
  import { page } from "$app/state";

  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";
  import { CheckIcon } from "@lucide/svelte";
  import { CommandItem } from "@/components/ui/command";
  import { cn } from "@/utils";
  import ProjectMemberRoleBadge from "@/components/app/projects/members/badges/project-member-role-badge.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { projectMembersBackendDataSource, ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    selectedMemberAccountId: number | null;
    entryRecord?: EntryRecord;
  }
  let { selectedMemberAccountId, entryRecord, onValueChange }: Props = $props();

  // Variables
  const resource: string = EntryRecord.type;

  let projectId = page.params.projectId as string;
  let wfStep = $derived(entryRecord?.wf_step || undefined);

  // Variables::Reactive
  let assignedToAccountId = $derived(selectedMemberAccountId);

  // Functions
  $effect(() => {
    onValueChange({ assigned_to_id: assignedToAccountId });
  });
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <SingleSelectDatasourceField
      name="{resource}/assigned_to_id"
      label="Member"
      placeholder="Select a member"
      displayKey="email"
      valueKey="account_id"
      dataSource={projectMembersBackendDataSource}
      listOptions={{
        filters: {
          project_id: projectId,
          enabled: true,
          role__in: wfStep === "review" ? ["reviewer", "project_owner"] : ["annotator", "reviewer", "project_owner"],
        },
      }}
      searchable
      searchKeyWithOperation="email__match"
      value={assignedToAccountId}
      onSelected={(value: string | number | null) => {
        assignedToAccountId = value as number;
      }}
    >
      {#snippet slotTriggerValue({ selectedChoice })}
        {#if selectedChoice}
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <span class="truncate">{selectedChoice.label}</span>
            <div class="ml-auto shrink-0">
              <ProjectMemberRoleBadge projectMemberRecord={selectedChoice.data as ProjectMemberRecord} />
            </div>
          </div>
        {/if}
      {/snippet}

      {#snippet slotChoice({ choice, select })}
        <CommandItem onclick={() => select(choice)}>
          <CheckIcon
            class={cn("mr-2 size-4 shrink-0", {
              "opacity-0": choice.value != assignedToAccountId,
            })}
          />
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <span class="truncate">{choice.label}</span>
            <div class="ml-auto shrink-0">
              <ProjectMemberRoleBadge projectMemberRecord={choice.data as ProjectMemberRecord} />
            </div>
          </div>
        </CommandItem>
      {/snippet}
    </SingleSelectDatasourceField>
  </FieldGroup>
</FieldSet>
