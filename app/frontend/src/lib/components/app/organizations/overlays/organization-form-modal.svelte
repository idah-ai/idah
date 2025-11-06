<script lang="ts">
  import { toast } from "svelte-sonner";

  import OrganizationForm from "@/components/app/organizations/forms/organization-form.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import { refetches } from "@/utils/refetch";

  import { AccountRecord, accountsBackendDataSource } from "@/data/model/iam/accounts/record";
  import { createAccountSchema, updateAccountSchema } from "@/data/model/iam/accounts/schema";
  import { getFieldErrors, validateData, type ZodSchema } from "@/utils/validate";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { Hash } from "@/utils/types";

  // Props
  interface Props extends FormModalBaseProps {
    organizationRecord?: AccountRecord;
  }
  let { action, open = $bindable(), title, organizationRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  let organization: AccountRecord = $derived(
    organizationRecord
      ? organizationRecord
      : new AccountRecord({
          type: AccountRecord.type,
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
    organization = new AccountRecord({
      type: AccountRecord.type,
      attributes: {
        name: null,
      },
    });
  }

  function setValue(value: Hash): void {
    organization.name = value.name;
  }

  async function createOrganization(): Promise<void> {
    try {
      await accountsBackendDataSource.create({
        attributes: {
          name: organization.name,
        },
      });

      $refetches.organizations.list = new Date();
      closeThisModal();
      toast.success("Organization created successfully");
    } catch (error) {
      toast.error("Failed to create organization");
      throw error;
    }
  }

  async function updateOrganization(): Promise<void> {
    try {
      await accountsBackendDataSource.update(organization.id, {
        attributes: {
          name: organization.name,
        },
      });

      $refetches.organizations.list = new Date();
      closeThisModal();
      toast.success("Organization updated successfully");
    } catch (error) {
      toast.error("Failed to update organization");
      throw error;
    }
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createAccountSchema : updateAccountSchema;

    try {
      const validated = validateData(schema, {
        name: organization.name,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        throw new Error("Failed to submit form");
      }

      if (newRecord) {
        await createOrganization();
      } else {
        await updateOrganization();
      }
    } catch (error) {
      console.error(error);
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <OrganizationForm {organization} {fieldErrors} onValueChange={setValue} />
</FormModal>
