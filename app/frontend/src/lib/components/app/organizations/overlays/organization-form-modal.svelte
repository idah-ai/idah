<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import OrganizationForm from "@/components/app/organizations/forms/organization-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";

  import { refetches } from "@/utils/refetch";

  import { showToast } from "@/components/ui/toast/index.svelte";
  import { OrganizationRecord, organizationsBackendDataSource } from "@/data/model/iam/organizations/record";
  import { createOrganizationSchema, updateOrganizationSchema } from "@/data/model/iam/organizations/schema";
  import { showActionFailedToast } from "@/utils/error/error.toasts";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    organizationRecord?: OrganizationRecord;
  }
  let { action, open = $bindable(), title, organizationRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  // Read-only seed for <OrganizationForm>; never mutated here.
  let organization: OrganizationRecord = $derived(
    organizationRecord
      ? organizationRecord
      : new OrganizationRecord({
          type: OrganizationRecord.type,
          attributes: {
            name: null,
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
    };
  }
  const changeTracker = new FormChangeTracker(serializeEditableFields, () => organizationRecord);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    changeTracker.reset();
    draft = {};
  }

  function setValue(value: Hash): void {
    draft = { ...value };
    changeTracker.update(value);
  }

  async function createOrganization(): Promise<void> {
    const createdOrganizationRes = await organizationsBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.organizations.list = new Date();
    goto(resolve(`/organizations/${createdOrganizationRes.data.id}/projects`));
    showToast.success({
      title: "Organization created",
      description: `The organization "${draft.name}" has been created.`,
    });
  }

  async function updateOrganization(): Promise<void> {
    await organizationsBackendDataSource.update(
      organizationRecord!.id,
      {
        attributes: {
          name: draft.name,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.organizations.list = new Date();
    showToast.success({
      title: "Organization updated",
      description: `The organization "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createOrganizationSchema : updateOrganizationSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createOrganization();
      } else {
        await updateOrganization();
      }
    } catch (error) {
      showActionFailedToast(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal
  {action}
  {title}
  loading={submitting}
  disabled={action === "update" ? !changeTracker.hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <OrganizationForm {organization} {fieldErrors} onValueChange={setValue} />
</FormModal>
