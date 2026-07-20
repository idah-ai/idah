<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import ProjectForm from "@/components/app/projects/forms/project-form.svelte";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { ProjectRecord, projectsBackendDataSource } from "@/data/model/dataset/projects/project-record";
  import { createProjectSchema, updateProjectSchema } from "@/data/model/dataset/projects/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
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

  // Read-only seed for <ProjectForm>; never mutated here.
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
  // Local edit buffer holding the current form values.
  let draft: Hash = $state({});

  // Single source of truth for the dirty comparison. Keys MUST be limited to
  // fields the form emits via onValueChange — used for BOTH the original-record
  // snapshot and the current-value snapshot.
  function serializeEditableFields(source: Hash): Hash {
    return {
      name: source.name,
      description: source.description,
      organization_id: source.organization_id,
    };
  }
  let savedSnapshot: string = $derived(projectRecord ? JSON.stringify(serializeEditableFields(projectRecord)) : "");
  let editedSnapshot: string | null = $state(null);
  let hasUnsavedChanges: boolean = $derived(editedSnapshot !== null && editedSnapshot !== savedSnapshot);

  // Functions
  function resetForm(): void {
    fieldErrors = {};
    editedSnapshot = null;
    draft = {};
  }

  function setValue(value: Hash): void {
    draft = { ...value };
    editedSnapshot = JSON.stringify(serializeEditableFields(value));
  }

  async function createProject() {
    const createdProjectRes = await projectsBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          description: draft.description,
          organization_id: draft.organization_id,
        },
      },
      {
        showErrorToast: false,
      },
    );

    open = false;
    $refetches.projects.list = new Date();
    goto(resolve(`/projects/${createdProjectRes.data.id}/datasets`));
    showToast.success({
      title: "Project created",
      description: `The project "${draft.name}" has been created.`,
    });
  }

  async function updateProject() {
    await projectsBackendDataSource.update(
      projectRecord!.id,
      {
        attributes: {
          name: draft.name,
          description: draft.description,
          organization_id: draft.organization_id,
        },
      },
      {
        showErrorToast: false,
      },
    );

    open = false;
    $refetches.projects.list = new Date();
    $refetches.projects.get = new Date();
    showToast.success({
      title: "Project updated",
      description: `The project "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createProjectSchema : updateProjectSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        organization_id: Number(draft.organization_id),
        description: draft.description,
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
      submitting = false;
      showActionFailedToast(error);
    }
  }
</script>

<FormModal
  {action}
  {title}
  loading={submitting}
  disabled={action === "update" ? !hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <ProjectForm {project} {fieldErrors} {preSelectedOrganizationId} onValueChange={setValue}></ProjectForm>
</FormModal>
