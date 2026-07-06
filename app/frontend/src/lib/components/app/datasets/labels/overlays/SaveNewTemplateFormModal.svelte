<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import InputField from "@/components/app/forms/fields/input/input-field.svelte";

  import { labellingConfigurationTemplateDataSource } from "@/data/model/dataset/labelling-configuration-template/record";
  import { showToast } from "@/components/ui/toast/index.svelte";
  import { showActionFailedToast } from "@/utils/error/error.toasts";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import type { IConfig } from "@/plugin/v2/types";

  interface Props extends FormModalBaseProps {
    config: IConfig;
    organizationId: number | string;
    onSaved?: () => void;
  }
  let { action, open = $bindable(), title, config, organizationId, onSaved }: Props = $props();

  let name = $state("");
  let submitting = $state(false);

  const configIsEmpty = $derived(Object.keys(config).length === 0);
  const disabledSaveButton = $derived(!name.trim() || configIsEmpty);

  function resetForm() {
    name = "";
  }

  async function submit() {
    submitting = true;
    try {
      await labellingConfigurationTemplateDataSource.create(
        {
          attributes: {
            name,
            labeling_configuration: config,
            organization_id: String(organizationId),
          },
        },
        { showErrorToast: false },
      );
      showToast.success({ title: `${name} has been created as a new tempalte` });
      onSaved?.();
      open = false;
      resetForm();
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
  disabled={disabledSaveButton}
  onCancel={resetForm}
  onConfirm={submit}
  bind:open
>
  <section class="px-1 pb-1">
    <InputField
      name="labeling_configuration_template.name"
      label="Name"
      placeholder="Template name"
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
  </section>
</FormModal>
