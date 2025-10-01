<script lang="ts">
  import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import Button from "@/components/ui/button/button.svelte";

  import type { ConfirmModalBaseProps } from "@/components/app/overlays/modals/confirm-modal.types";

  // Props
  let {
    title,
    description,
    open = $bindable(),
    modalTitle,
    modalDescription,
    children,
    confirm,
    confirmLabel = "Confirm",
    onCancel,
    onConfirm,
  }: ConfirmModalBaseProps = $props();
</script>

<AlertDialog bind:open>
  <AlertDialogContent>
    <AlertDialogHeader>
      {#if modalTitle}
        {@render modalTitle()}
      {:else}
        <AlertDialogTitle>{title}</AlertDialogTitle>
      {/if}
    </AlertDialogHeader>

    {#if modalDescription}
      {@render modalDescription()}
    {:else}
      <AlertDialogDescription>{description}</AlertDialogDescription>
    {/if}

    {@render children?.()}

    <AlertDialogFooter>
      <AlertDialogCancel onclick={onCancel}>Cancel</AlertDialogCancel>

      {#if confirm}
        {@render confirm()}
      {:else}
        <Button variant="destructive" onclick={onConfirm}>{confirmLabel}</Button>
      {/if}
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
