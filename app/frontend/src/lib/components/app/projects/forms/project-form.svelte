<script lang="ts">
  import { onMount } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import TextareaField from "@/components/app/forms/fields/input/textarea-field.svelte";
  import SingleSelectDatasourceField from "@/components/app/forms/fields/select/single/single-select-datasource-field.svelte";
  import ProjectStorageTargetField from "@/components/app/projects/storage-target/project-storage-target-field.svelte";
  import ProjectStorageTargetLabel from "@/components/app/projects/storage-target/project-storage-target-label.svelte";
  import { FieldGroup, FieldSet } from "@/components/ui/field";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { authStatus } from "@/security/AuthContext";

  import type { FormBaseProps } from "@/components/app/forms/form.types";
  import type { ProjectStorageTargetSummary } from "@/data/model/setting/storage_target/utils";

  // Props
  interface Props extends FormBaseProps {
    project: ProjectRecord;
    preSelectedOrganizationId?: string;
  }
  let { project, preSelectedOrganizationId, fieldErrors, onValueChange }: Props = $props();

  // Variables
  const isNewRecord = $derived(!project.id);

  let resource: string = ProjectRecord.type;
  let canReadOrganizationAsOrgOwner = $state(false);

  // Variables::Reactive
  let { name, description, organization_id, storage_target_id } = $derived(project);

  // Lifecycle
  onMount(async () => {
    const currentAccount = $authStatus.authContext;
    canReadOrganizationAsOrgOwner = (await currentAccount?.can("read", "iam:organizations", ["as_org_owner"])) || false;
  });

  // Functions
  $effect(() => {
    onValueChange({ name, description, organization_id, storage_target_id });
  });

  // An existing project's storage can't change: it is only shown.
  async function loadStorageTarget(): Promise<ProjectStorageTargetSummary | null> {
    const res = await projectsBackendDataSource.get(project.id, {
      fields: { [ProjectRecord.type]: ["storage_target_id"] },
    });

    return (res.meta?.storage_target as ProjectStorageTargetSummary | undefined) ?? null;
  }
</script>

<FieldSet class="p-1">
  <FieldGroup>
    <!-- PROJECT::NAME -->
    <InputField
      name="{resource}/name"
      label="Name"
      placeholder="Enter project name"
      required
      errors={fieldErrors["name"]}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />

    <!-- PROJECT::ORGANIZATION -->
    {#if !preSelectedOrganizationId && canReadOrganizationAsOrgOwner}
      <SingleSelectDatasourceField
        name="{resource}/organization_id"
        label="Organization"
        placeholder="Select an organization"
        dataSource={organizationsBackendDataSource}
        displayKey="name"
        required
        errors={fieldErrors["organization_id"]}
        value={organization_id}
        onSelected={(value: string | number | null) => {
          // the select emits the id as a string; the record stores a number.
          // Coerce so dirty-state comparison and the payload use a real number
          organization_id = (value == null ? null : Number(value)) as number;
        }}
        searchKeyWithOperation="name__match"
        disabled={!isNewRecord}
      />
    {/if}

    <!-- PROJECT::STORAGE_TARGET -->
    {#if isNewRecord}
      <ProjectStorageTargetField
        name="{resource}/storage_target_id"
        organizationId={organization_id
          ? Number(organization_id)
          : preSelectedOrganizationId
            ? Number(preSelectedOrganizationId)
            : null}
        value={storage_target_id ?? null}
        errors={fieldErrors["storage_target_id"]}
        onSelected={(targetId) => (storage_target_id = targetId)}
      />
    {:else}
      {#await loadStorageTarget() then summary}
        <ProjectStorageTargetLabel {summary} />
      {/await}
    {/if}

    <!-- PROJECT::DESCRIPTION -->
    <TextareaField
      name="{resource}/description"
      label="Description"
      placeholder="Enter project description"
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    />
  </FieldGroup>
</FieldSet>
