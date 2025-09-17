<script lang="ts">
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import Button from "@/components/ui/button/button.svelte";

  import { refetches } from "@/utils/refetch";

  import { EntryRecord } from "@/data/model/dataset/entries/record";

  import type { Hash } from "@/utils/types";
  import type { FormModalBaseProps } from "@/components/app/overlays/modals/form-modal.types";
  import { toast } from "svelte-sonner";

  // Props
  interface Props extends FormModalBaseProps {}
  let { action, title, open = $bindable() }: Props = $props();

  // Variables
  let submitting: boolean = $state(false);
  let entry: EntryRecord = $derived(
    new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    }),
  );

  // Functions
  function resetForm(): void {
    entry = new EntryRecord({
      type: EntryRecord.type,
      attributes: {},
    });
  }

  function setValue(value: Hash): void {}

  async function importMedia(): Promise<void> {
    toast.success("Tasks successfully uploaded!");
    $refetches.entries.list++;
    open = false;
  }

  async function submit(): Promise<void> {
    submitting = true;

    try {
      await importMedia();
    } catch (error) {
    } finally {
      submitting = false;
    }
  }
</script>

<FormModal {action} {title} loading={submitting} onCancel={resetForm} onConfirm={submit} bind:open>
  {#snippet confirm()}
    <Button onclick={submit}>Upload</Button>
  {/snippet}
</FormModal>
