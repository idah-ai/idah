<script lang="ts">
  import { page } from "$app/state";

  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

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
          role__in: wfStep === "review" ? ["reviewer", "project_owner"] : ["annotator", "project_owner"],
        },
      }}
      searchKeyWithOperation="email__match"
      value={assignedToAccountId}
      onSelected={(value: string | number) => {
        assignedToAccountId = value as number;
      }}
    ></SingleSelectDatasourceField>
  </FieldGroup>
</FieldSet>
