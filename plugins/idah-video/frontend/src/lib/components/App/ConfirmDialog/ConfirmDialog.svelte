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
  let { open, title, description, onConfirm } = $derived($confirmDialogState);

  // Functions
  function handleClickConfirm() {
    onConfirm();
    closeConfirmDialog();
  }
</script>

<AlertDialog bind:open>
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
