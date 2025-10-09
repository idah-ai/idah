<script lang="ts">
  import { page } from "$app/state";

  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import Form from "@/components/app/forms/form.svelte";

  import { EntryRecord } from "@/data/model/dataset/entries/record";
  import { projectMembersBackendDataSource } from "@/data/model/dataset/projects/members/record";

  import type { FormBaseProps } from "@/components/app/forms/form.types";

  // Props
  interface Props extends FormBaseProps {
    selectedMember: number | null;
  }
  let { selectedMember, onValueChange }: Props = $props();

  // Variables
  const resource: string = EntryRecord.type;

  let projectId = page.params.projectId as string;

  // Variables::Reactive
  let assignedToId = $derived(selectedMember);

  // Functions
  $effect(() => {
    onValueChange({ assigned_to_id: assignedToId });
  });
</script>

<Form>
  <SingleSelectDatasourceField
    name="{resource}/assigned_to_id"
    label="Member"
    placeholder="Select a member"
    displayKey="email"
    dataSource={projectMembersBackendDataSource}
    listOptions={{
      filters: {
        project_id: projectId,
      },
    }}
    searchKeyWithOperation="email__match"
    value={assignedToId}
    onValueChange={(value: string | number) => {
      assignedToId = value as number;
    }}
  ></SingleSelectDatasourceField>
</Form>
