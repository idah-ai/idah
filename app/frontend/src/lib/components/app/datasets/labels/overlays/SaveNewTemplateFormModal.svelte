<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";

  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";

  interface Props extends FormModalBaseProps {
    //
  }
  let { action, open = $bindable(), title }: Props = $props();

  let submitting = $state(false);

  function resetForm() {}

  async function submit() {}
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  <!-- InputField (name) -->
</FormModal>
