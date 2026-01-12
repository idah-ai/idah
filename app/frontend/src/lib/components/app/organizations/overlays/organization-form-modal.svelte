<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { toast } from "svelte-sonner";

  import OrganizationForm from "@/components/app/organizations/forms/organization-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { refetches } from "@/utils/refetch";

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

  // Functions
  function closeThisModal(): void {
    open = false;
  }

  function resetForm(): void {
    fieldErrors = {};
    organization = new OrganizationRecord({
      type: OrganizationRecord.type,
      attributes: {
        name: null,
      },
    });
  }

  function setValue(value: Hash): void {
    organization.name = value.name;
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
    toast.success("Organization created", {
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
    toast.success("Organization updated", {
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

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <OrganizationForm {organization} {fieldErrors} onValueChange={setValue} />
</FormModal>
