<script lang="ts">
  import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "$lib/components/ui/AlertDialog";
  import Button from "$lib/components/ui/Button/Button.svelte";

  import { closeConfirmDialog, confirmDialogState } from "$lib/components/App/ConfirmDialog/confirm-dialog";

  // Variables
  let { open, title, description, onConfirm, onCancel } = $derived($confirmDialogState);

  // Functions
  function handleClickConfirm() {
    onConfirm();
    closeConfirmDialog();
  }

  function handleCancel() {
    if (onCancel) onCancel();
    closeConfirmDialog();
  }
</script>

  <AlertDialog bind:open onClose={handleCancel}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      <!-- Render custom content here -->

      <AlertDialogFooter>
        <AlertDialogCancel onclick={handleCancel}>Cancel</AlertDialogCancel>
        <Button variant="destructive" onclick={handleClickConfirm}>Confirm</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
