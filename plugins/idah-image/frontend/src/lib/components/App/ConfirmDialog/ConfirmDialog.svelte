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

  import { closeConfirmDialog, confirmDialogState, hideConfirmDialog } from "$lib/components/App/ConfirmDialog/confirm-dialog";

  // Variables
  let { open, title, description, onConfirm, onCancel } = $derived($confirmDialogState);

  // Functions
  function handleClickConfirm() {
    onConfirm();
    // Open → closed, but keep the payload mounted for the exit animation.
    hideConfirmDialog();
  }

  function handleOpenChange(next: boolean) {
    if (next) return;
    onCancel?.();
    hideConfirmDialog();
  }

  function handleOpenChangeComplete(next: boolean) {
    if (!next) closeConfirmDialog();
  }
</script>

<AlertDialog
  open={open}
  onOpenChange={handleOpenChange}
  onOpenChangeComplete={handleOpenChangeComplete}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{description}</AlertDialogDescription>
    </AlertDialogHeader>

    <!-- Render custom content here -->

    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <Button variant="destructive" onclick={handleClickConfirm}>Confirm</Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
