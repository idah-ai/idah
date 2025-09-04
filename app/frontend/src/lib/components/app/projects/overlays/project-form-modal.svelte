<script lang="ts">
  import { goto } from "$app/navigation";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectForm from "@/components/app/projects/forms/project-form.svelte";

  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
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

    goto(`/projects/${createdProjectRes.data.id}/tasks`);

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
    submitting = true;

    try {
      // const validated = project.validate();
      if (newRecord) {
        await createProject();
      } else {
        await updateProject();
      }
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <ProjectForm {project} onValueChange={setValue}></ProjectForm>
</FormModal>
