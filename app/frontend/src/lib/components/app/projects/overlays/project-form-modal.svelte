<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectForm from "@/components/app/projects/forms/project-form.svelte";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { createProjectSchema, updateProjectSchema } from "@/data/model/dataset/projects/schema";
  import { refetches } from "@/utils/refetch";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    projectRecord?: ProjectRecord;
    preSelectedOrganizationId?: string;
  }
  let { action, open = $bindable(), title, projectRecord, preSelectedOrganizationId }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  let project: ProjectRecord = $derived(
    projectRecord
      ? projectRecord
      : new ProjectRecord({
          type: "datasets:projects",
          attributes: {
            name: null,
            description: null,
            organization_id: preSelectedOrganizationId || null,
          },
        }),
  );

  // Functions
  function resetForm(): void {
    fieldErrors = {};
    project = new ProjectRecord({
      type: "datasets:projects",
      attributes: {
        name: null,
        description: null,
        organization_id: preSelectedOrganizationId || null,
      },
    });
  }

  function setValue(value: Hash): void {
    project.name = value.name;
    project.description = value.description;
    project.organization_id = value.organization_id;
  }

  async function createProject() {
    const createdProjectRes = await projectsBackendDataSource.create({
      attributes: {
        name: project.name,
        description: project.description,
        organization_id: project.organization_id,
      },
    });

    goto(resolve(`/projects/${createdProjectRes.data.id}/datasets`));

    $refetches.projects.list = new Date();
    open = false;
  }

  async function updateProject() {
    await projectsBackendDataSource.update(project.id, {
      attributes: {
        name: project.name,
        description: project.description,
        organization_id: project.organization_id,
      },
    });

    $refetches.projects.list = new Date();
    $refetches.projects.get = new Date();
    open = false;
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createProjectSchema : updateProjectSchema;

    try {
      const validated = validateData(schema, {
        name: project.name,
        organization_id: Number(project.organization_id),
        description: project.description,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createProject();
      } else {
        await updateProject();
      }
    } catch (error) {
      console.error(error);
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <ProjectForm {project} {fieldErrors} {preSelectedOrganizationId} onValueChange={setValue}></ProjectForm>
</FormModal>
