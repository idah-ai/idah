<script lang="ts">
    import WebhookForm from "@/components/app/notification/webhook/forms/webhook-form.svelte";
    import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
    
    import { showToast } from "@/components/ui/toast/index.svelte";
    import { showActionFailedToast } from "@/utils/error/error.toasts";
    import { FormChangeTracker } from "@/utils/form/form-change-tracker.svelte";
    import { refetches } from "@/utils/refetch";
    
    import { WebhookRecord, webhooksBackendDataSource } from "@/data/model/notification/webhooks/record";
    import { createWebhookSchema, updateWebhookSchema } from "@/data/model/notification/webhooks/schema";
    import { getFieldErrors, validateData } from "@/utils/validate";

    import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
    import type { Hash } from "@/utils/types";
    import type { ZodSchema } from "zod";

 // Props
  interface Props extends FormModalBaseProps {
    webhookRecord?: WebhookRecord;
  }
  let { action, open = $bindable(), title, webhookRecord }: Props = $props();

  // Variables
  let newRecord: boolean = $derived(action === "create");
  let fieldErrors: Hash = $state({});
  let submitting: boolean = $state(false);

  // Read-only seed for <WebhookForm>; never mutated here.
  let webhook: WebhookRecord = $derived(
    webhookRecord
      ? webhookRecord
      : new WebhookRecord({
          type: WebhookRecord.type,
          attributes: {
            name: null,
            url: null,
            event_type: null,
            secret_key: null,
            enabled: false,
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
      url: source.url,
      event_type: source.event_type,
      secret_key: source.secret_key,
      enabled: source.enabled,
    };
  }
  const changeTracker = new FormChangeTracker(serializeEditableFields, () => webhookRecord);

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
 async function createWebhook(): Promise<void> {
    await webhooksBackendDataSource.create(
      {
        attributes: {
          name: draft.name,
          url: draft.url,
          event_type: draft.event_type,
          secret_key: draft.secret_key,
          enabled: draft.enabled,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.webhooks.list = new Date();
    showToast.success({
      title: "Webhook created",
      description: `The webhook "${draft.name}" has been created.`,
    });
  }

  async function updateWebhook(): Promise<void> {
    await webhooksBackendDataSource.update(
      webhookRecord!.id,
      {
        attributes: {
          name: draft.name,
          url: draft.url,
          event_type: draft.event_type,
          secret_key: draft.secret_key,
          enabled: draft.enabled,
        },
      },
      {
        showErrorToast: false,
      },
    );

    closeThisModal();
    $refetches.webhooks.list = new Date();
    showToast.success({
      title: "Webhook updated",
      description: `The webhook "${draft.name}" has been updated.`,
    });
  }

  async function submit(): Promise<void> {
    fieldErrors = {};
    submitting = true;
    const schema: ZodSchema = newRecord ? createWebhookSchema : updateWebhookSchema;

    try {
      const validated = validateData(schema, {
        name: draft.name,
        url: draft.url,
        event_type: draft.event_type,
        secret_key: draft.secret_key,
        enabled: draft.enabled,
      });

      if (!validated.success) {
        fieldErrors = getFieldErrors(validated.error);
        submitting = false;
        return;
      }

      if (newRecord) {
        await createWebhook();
      } else {
        await updateWebhook();
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
  <WebhookForm {webhook} {fieldErrors} onValueChange={setValue} />
</FormModal>
