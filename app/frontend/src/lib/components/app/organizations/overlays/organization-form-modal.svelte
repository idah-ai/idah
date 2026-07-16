<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import OrganizationForm from "@/components/app/organizations/forms/organization-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

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

  // Clone so the incoming prop stays pristine as the diff baseline (also avoids
  // mutating the parent's fetched record in place).
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

  // Dirty-state tracking (only the editable fields, fixed key order).
  function serializeEditableFields(record: OrganizationRecord): Hash {
    return {
      name: record.name,
    };
  }
  let savedSnapshot: string = $derived(
    organizationRecord ? JSON.stringify(serializeEditableFields(organizationRecord)) : "",
  );
  let editedSnapshot: string | null = $state(null);
  let hasUnsavedChanges: boolean = $derived(editedSnapshot !== null && editedSnapshot !== savedSnapshot);

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    editedSnapshot = null;
    organization = new OrganizationRecord({
      type: OrganizationRecord.type,
      attributes: {
        name: null,
      },
    });
  }

  function setValue(value: Hash): void {
    organization.name = value.name;
    editedSnapshot = JSON.stringify({
      name: value.name,
    });
  }

  async function createOrganization(): Promise<void> {
    const createdOrganizationRes = await organizationsBackendDataSource.create(
      {
        attributes: {
          name: organization.name,
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
      description: `The organization "${organization.name}" has been created.`,
    });
  }

  async function updateOrganization(): Promise<void> {
    await organizationsBackendDataSource.update(
      organization.id,
      {
        attributes: {
          name: organization.name,
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
      description: `The organization "${organization.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createOrganizationSchema : updateOrganizationSchema;

    try {
      const validated = validateData(schema, {
        name: organization.name,
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
  disabled={action === "update" ? !hasUnsavedChanges : false}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <OrganizationForm {organization} {fieldErrors} onValueChange={setValue} />
</FormModal>
