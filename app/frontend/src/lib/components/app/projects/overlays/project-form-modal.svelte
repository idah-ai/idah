<script lang="ts">
  import { goto } from "$app/navigation";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectForm from "@/components/app/projects/forms/project-form.svelte";

  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { createProjectSchema, updateProjectSchema } from "@/data/model/dataset/projects/schema";
  import { refetches } from "@/utils/refetch";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    projectRecord?: ProjectRecord;
  }
  let { action, open = $bindable(), title, projectRecord }: Props = $props();

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
      },
    });
  }

  function setValue(value: Hash): void {
    project.name = value.name;
    project.description = value.description;
  }

  async function createProject() {
    const createdProjectRes = await projectsBackendDataSource.create({
      attributes: {
        name: project.name,
        description: project.description,
      },
    });

    goto(`/projects/${createdProjectRes.data.id}/datasets`);

    $refetches.projects.list++;
    open = false;
  }

  async function updateProject() {
    await projectsBackendDataSource.update(project.id, {
      attributes: {
        name: project.name,
        description: project.description,
      },
    });

    $refetches.projects.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createProjectSchema : updateProjectSchema;

    try {
      const validated = validateData(schema, {
        name: project.name,
        description: project.description,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        throw new Error("Failed to submit form");
      }

      if (newRecord) {
        await createProject();
      } else {
        await updateProject();
      }
    } catch (error) {
      // Handle unexpected errors
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <ProjectForm {project} {fieldErrors} onValueChange={setValue}></ProjectForm>
</FormModal>
