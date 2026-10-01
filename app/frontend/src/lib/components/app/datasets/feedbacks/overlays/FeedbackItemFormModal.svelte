<script lang="ts">
  import { getContext } from "svelte";

  import Button from "@/components/ui/button/button.svelte";
  import DialogClose from "@/components/ui/dialog/dialog-close.svelte";
  import FormModal from "@/components/app/overlays/modals/form-modal.svelte";
  import FeedbackItemForm from "@/components/app/datasets/feedbacks/forms/FeedbackItemForm.svelte";

  import { getFeedbackConfigController } from "@/components/app/datasets/feedbacks/feedback.controller.svelte";

  const key: symbol = getContext("key");
  const controller = getFeedbackConfigController(key);

  async function submit() {
    controller.upsertItem();
    controller.closeFormModal();
  }
</script>

<FormModal
  action={controller.formModalAction}
  title="Feedback"
  onCancel={() => controller.closeFormModal()}
  onConfirm={submit}
  bind:open={controller.formModalOpen}
>
  <FeedbackItemForm />

  {#snippet actions()}
    <div class="flex w-full gap-2">
      <DialogClose class="mr-auto">
        <Button variant="outline" class="w-full lg:w-auto" onclick={() => controller.closeFormModal()}>Cancel</Button>
      </DialogClose>

      <Button disabled={controller.formIsInvalid} onclick={submit}>
        {controller.isFormModalCreate ? "Add Feedback" : "Save Changes"}
      </Button>
    </div>
  {/snippet}
</FormModal>
